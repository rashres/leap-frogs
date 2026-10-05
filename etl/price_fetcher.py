#!/usr/bin/env python3
"""
Instrument Price Fetcher

Refreshes instrument.last_price in the Operational Database (leapfrogsdb)
from Yahoo Finance via yfinance.

The Spring API reads last_price when pricing an order, so this script is the
only thing that decides what an instrument is worth. Run it before placing
orders, and on a schedule to keep prices current.

Execution:
    python price_fetcher.py
"""

import logging
import sys
from decimal import Decimal, ROUND_HALF_UP

import yfinance as yf
from sqlalchemy import create_engine, text

from config import DB_OPERATIONAL
from logger_config import setup_logger

logger = logging.getLogger(__name__)

# instrument.last_price is NUMERIC(18,6); yfinance returns full float precision,
# so round here rather than letting Postgres do it silently.
PRICE_PRECISION = Decimal("0.000001")


def _to_price(value) -> Decimal:
    """Convert a yfinance float to a Decimal at the column's precision."""
    return Decimal(str(value)).quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)


def fetch_price(symbol: str) -> Decimal | None:
    """
    Return the latest market price for a Yahoo Finance symbol.

    Tries the quote metadata first (fast, and populated outside market hours),
    then falls back to the most recent daily close. Returns None if neither is
    available, so one bad symbol cannot abort the whole run.
    """
    try:
        ticker = yf.Ticker(symbol)

        info = getattr(ticker, "fast_info", None)
        if info is not None:
            price = info.get("last_price") if hasattr(info, "get") else None
            if price:
                return _to_price(price)

        history = ticker.history(period="1d")
        if not history.empty:
            return _to_price(history["Close"].iloc[-1])

        logger.warning("  ! %s: no price data returned", symbol)
        return None
    except Exception as exc:
        logger.warning("  ! %s: fetch failed (%s)", symbol, exc)
        return None


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

    if not instruments:
        logger.warning("No instruments found - nothing to price")
        return 0

    logger.info("Fetching prices for %d instruments", len(instruments))

    updated = 0
    for instrument_id, symbol in instruments:
        price = fetch_price(symbol)
        if price is None or price <= 0:
            continue

        # Each price is committed on its own so a later failure cannot roll
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
        logger.info("  ✓ %-8s %s", symbol, price)
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
