#!/usr/bin/env python3
"""
Instrument Price Fetcher

Refreshes instrument.last_price in the Operational Database (leapfrogsdb)
from Yahoo Finance via yfinance, and records each price in instrument_price
for charts.

The Spring API reads last_price when pricing an order, so this script is the
only thing that decides what an instrument is worth. Run it before placing
orders, and on a schedule to keep prices current.

Every price is stored in USD. Yahoo quotes LSE stocks in pence (GBp) and NSE
stocks in rupees (INR), so those are converted with the latest
<CCY>USD=X rate before they are written.

Price history: each run upserts one row per instrument per minute. The first
time an instrument has no history older than two days, a year of daily closes
and five days of 15-minute bars are loaded from Yahoo. Backfilled non-USD bars
are converted at today's exchange rate, not the rate on the day.

Execution:
    python price_fetcher.py
"""

import logging
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import yfinance as yf
from sqlalchemy import create_engine, text

from config import DB_OPERATIONAL
from logger_config import setup_logger

logger = logging.getLogger(__name__)

# instrument.last_price is NUMERIC(18,6); yfinance returns full float precision,
# so round here rather than letting Postgres do it silently.
PRICE_PRECISION = Decimal("0.000001")

# Yahoo's minor-unit currency codes and how many of them make one major unit.
MINOR_UNITS = {"GBp": ("GBP", Decimal(100)), "GBX": ("GBP", Decimal(100)), "ZAc": ("ZAR", Decimal(100))}

# Without history older than this, an instrument is backfilled.
BACKFILL_IF_NEWER_THAN = timedelta(days=2)

# A database created before markets-and-price-history.sql has no instrument_price table.
HISTORY_TABLE_EXISTS = """
    SELECT to_regclass('public.instrument_price') IS NOT NULL
"""


def _to_price(value) -> Decimal:
    """Convert a yfinance float to a Decimal at the column's precision."""
    return Decimal(str(value)).quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)


class UsdConverter:
    """Converts a quote in any Yahoo currency to USD, caching one rate per currency per run."""

    def __init__(self):
        self._rates: dict[str, Decimal | None] = {"USD": Decimal(1)}

    def factor(self, currency: str | None) -> Decimal | None:
        """Multiplier from `currency` to USD, or None if no rate is available."""
        if not currency:
            return Decimal(1)
        divisor = Decimal(1)
        if currency in MINOR_UNITS:
            currency, divisor = MINOR_UNITS[currency]
        currency = currency.upper()
        if currency not in self._rates:
            self._rates[currency] = self._fetch_rate(currency)
        rate = self._rates[currency]
        return rate / divisor if rate is not None else None

    @staticmethod
    def _fetch_rate(currency: str) -> Decimal | None:
        quote = fetch_quote(yf.Ticker(f"{currency}USD=X"))
        if quote is None:
            return None
        logger.info("  · %sUSD %s", currency, quote[0])
        return Decimal(str(quote[0]))


def fetch_quote(ticker) -> tuple[float, str | None] | None:
    """
    Return (latest price, quote currency) for a yfinance Ticker.

    Tries the quote metadata first (fast, and populated outside market hours),
    then falls back to the most recent daily close. Returns None if neither is
    available, so one bad symbol cannot abort the whole run.
    """
    try:
        info = ticker.fast_info
        currency = info.get("currency")
        price = info.get("last_price")
        if price:
            return price, currency

        history = ticker.history(period="1d")
        if not history.empty:
            return float(history["Close"].iloc[-1]), currency

        logger.warning("  ! %s: no price data returned", ticker.ticker)
        return None
    except Exception as exc:
        logger.warning("  ! %s: fetch failed (%s)", ticker.ticker, exc)
        return None


def backfill_rows(ticker, instrument_id: int, factor: Decimal) -> list[dict]:
    """A year of daily closes plus five days of 15-minute bars, converted to USD."""
    rows: dict[datetime, dict] = {}
    for period, interval in (("1y", "1d"), ("5d", "15m")):
        try:
            bars = ticker.history(period=period, interval=interval)
        except Exception as exc:
            logger.warning("  ! %s: %s history failed (%s)", ticker.ticker, interval, exc)
            continue
        for stamp, close in bars["Close"].dropna().items():
            price = _to_price(Decimal(str(close)) * factor)
            if price <= 0:
                continue
            at = stamp.to_pydatetime().astimezone(timezone.utc)
            rows[at] = {"instrument_id": instrument_id, "observed_at": at, "price": price}
    return list(rows.values())


def refresh_prices(connection_string: str) -> int:
    """
    Fetch a price for every instrument and write it back.

    Returns the number of instruments successfully updated.
    """
    engine = create_engine(connection_string)

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        logger.info("✓ Connected to Operational DB")
        instruments = conn.execute(
            text("SELECT instrument_id, symbol FROM instrument ORDER BY instrument_id")
        ).fetchall()
        record_history = conn.execute(text(HISTORY_TABLE_EXISTS)).scalar()
        oldest = (
            dict(conn.execute(text(
                "SELECT instrument_id, min(observed_at) FROM instrument_price GROUP BY instrument_id"
            )).fetchall())
            if record_history else {}
        )

    if not instruments:
        logger.warning("No instruments found - nothing to price")
        return 0
    if not record_history:
        logger.warning("instrument_price table missing - prices update, history is not recorded")

    logger.info("Fetching prices for %d instruments", len(instruments))

    usd = UsdConverter()
    now = datetime.now(timezone.utc)
    minute = now.replace(second=0, microsecond=0)
    updated = 0
    for instrument_id, symbol in instruments:
        ticker = yf.Ticker(symbol)
        quote = fetch_quote(ticker)
        if quote is None:
            continue
        raw, currency = quote
        factor = usd.factor(currency)
        if factor is None:
            logger.warning("  ! %s: no %s→USD rate, keeping previous price", symbol, currency)
            continue
        price = _to_price(Decimal(str(raw)) * factor)
        if price <= 0:
            continue

        backfill = []
        if record_history:
            first = oldest.get(instrument_id)
            if first is None or now - first < BACKFILL_IF_NEWER_THAN:
                backfill = backfill_rows(ticker, instrument_id, factor)

        # Each instrument is committed on its own so a later failure cannot roll
        # back prices already fetched.
        with engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE instrument
                       SET last_price = :price,
                           price_updated_at = now()
                     WHERE instrument_id = :instrument_id
                """),
                {"price": price, "instrument_id": instrument_id},
            )
            if record_history:
                if backfill:
                    conn.execute(
                        text("""
                            INSERT INTO instrument_price (instrument_id, observed_at, price)
                            VALUES (:instrument_id, :observed_at, :price)
                            ON CONFLICT (instrument_id, observed_at) DO NOTHING
                        """),
                        backfill,
                    )
                conn.execute(
                    text("""
                        INSERT INTO instrument_price (instrument_id, observed_at, price)
                        VALUES (:instrument_id, :observed_at, :price)
                        ON CONFLICT (instrument_id, observed_at) DO UPDATE SET price = EXCLUDED.price
                    """),
                    {"instrument_id": instrument_id, "observed_at": minute, "price": price},
                )

        note = f" ({raw} {currency})" if currency and currency != "USD" else ""
        extra = f", backfilled {len(backfill)} bars" if backfill else ""
        logger.info("  ✓ %-12s %s USD%s%s", symbol, price, note, extra)
        updated += 1

    skipped = len(instruments) - updated
    if skipped:
        logger.warning("%d instrument(s) kept their previous price", skipped)
    logger.info("✓ Updated %d/%d instrument prices", updated, len(instruments))
    return updated


def main() -> None:
    setup_logger()
    logger.info("=" * 70)
    logger.info("INSTRUMENT PRICE FETCHER")
    logger.info("=" * 70)

    try:
        updated = refresh_prices(DB_OPERATIONAL)
    except Exception as exc:
        logger.error("✗ Price refresh failed: %s", exc)
        sys.exit(1)

    # Nothing priced means the API still cannot value orders, so fail loudly.
    if updated == 0:
        logger.error("✗ No prices were updated")
        sys.exit(1)


if __name__ == "__main__":
    main()
