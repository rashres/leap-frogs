#!/usr/bin/env python3
"""
Sample Order Seeder

Gives the sample accounts (2-6) a few months of trading history at real
prices, so the Portfolio page and its value chart look like a real account.

Each order uses the price recorded in instrument_price at the moment it was
placed, takes cash out on a buy and puts it back on a sell, and holdings are
rebuilt from the filled orders. So cash, holdings and orders always agree.

Needs price history, so run it after the first price fetch:

    docker compose run --rm price-fetcher python seed_orders.py

It does nothing if the sample accounts already have orders. To wipe the
sample accounts (and account 1) back to their starting cash and seed again:

    docker compose run --rm price-fetcher python seed_orders.py --reset

The same orders come out on every run (fixed random seed), apart from prices.
"""

import argparse
import logging
import random
import sys
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

from sqlalchemy import create_engine, text

from config import DB_OPERATIONAL
from logger_config import setup_logger

logger = logging.getLogger(__name__)

# Starting cash, the same amounts as database/capstone-mvp-schema.sql.
# Account 1 is reset but never seeded: the integration tests trade on it.
STARTING_CASH = {
    "jane@example.com": Decimal("10000.00"),
    "alice.cooper@example.com": Decimal("10000.00"),
    "bob.dylan@example.com": Decimal("15000.00"),
    "carol.white@example.com": Decimal("12000.00"),
    "david.green@example.com": Decimal("20000.00"),
    "emma.harris@example.com": Decimal("8000.00"),
}

# What each sample account likes to buy.
STYLES = {
    "alice.cooper@example.com": ["AAPL", "MSFT", "AMZN", "TSLA"],
    "bob.dylan@example.com": ["BTC-USD", "ETH-USD", "TSLA", "AAPL"],
    "carol.white@example.com": ["SHEL.L", "HSBA.L", "VOD.L", "RELIANCE.NS", "INFY.NS"],
    "david.green@example.com": ["AAPL", "MSFT", "SHEL.L", "TCS.NS", "BTC-USD", "EURUSD=X"],
    "emma.harris@example.com": ["ETH-USD", "BTC-USD", "AMZN", "INFY.NS"],
}

# These accounts also get one order rejected for insufficient cash.
WITH_REJECTED_ORDER = {"bob.dylan@example.com", "emma.harris@example.com"}

HISTORY_DAYS = 90
ORDERS_PER_ACCOUNT = (7, 10)
BUY_SHARE_OF_CASH = (0.12, 0.25)
MIN_CASH_TO_BUY = Decimal("250")
RANDOM_SEED = 2026

# Trading hours in UTC, roughly, so orders land while each market is open.
MARKET_HOURS_UTC = {"NASDAQ": (14, 20), "LSE": (8, 16), "NSE": (4, 10), "Binance": (0, 23), "FX": (1, 21)}

QTY = Decimal("0.000001")
CENTS = Decimal("0.01")


def load_context(conn) -> tuple[dict, dict]:
    accounts = {
        email: account_id
        for account_id, email in conn.execute(text("SELECT account_id, email FROM account"))
    }
    instruments = {
        symbol: (instrument_id, exchange)
        for instrument_id, symbol, exchange in conn.execute(text(
            "SELECT i.instrument_id, i.symbol, e.name FROM instrument i JOIN exchange e USING (exchange_id)"
        ))
    }
    return accounts, instruments


def price_at(conn, instrument_id: int, at: datetime) -> Decimal | None:
    """The latest price recorded at or before `at`."""
    return conn.execute(
        text("""
            SELECT price FROM instrument_price
             WHERE instrument_id = :id AND observed_at <= :at
             ORDER BY observed_at DESC LIMIT 1
        """),
        {"id": instrument_id, "at": at},
    ).scalar()


def order_times(rng: random.Random, count: int, now: datetime) -> list[datetime]:
    """`count` days spread over the history window, oldest first; hours are set per market later."""
    days = sorted(rng.sample(range(2, HISTORY_DAYS), count), reverse=True)
    return [(now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0) for d in days]


def at_market_hours(rng: random.Random, day: datetime, exchange: str) -> datetime:
    start, end = MARKET_HOURS_UTC.get(exchange, (14, 20))
    return datetime.combine(day.date(), time(rng.randint(start, end), rng.randint(0, 59)), tzinfo=timezone.utc)


def quantity_for(amount: Decimal, price: Decimal) -> Decimal:
    """Whole shares when at least one is affordable, otherwise a fraction (crypto)."""
    if price <= amount:
        return (amount / price).to_integral_value(rounding=ROUND_DOWN)
    return (amount / price).quantize(Decimal("0.0001"), rounding=ROUND_DOWN)


def plan_orders(conn, rng: random.Random, email: str, instruments: dict, now: datetime) -> tuple[list[dict], Decimal]:
    """Orders for one account, oldest first, and the cash left after them."""
    cash = STARTING_CASH[email]
    held: dict[str, Decimal] = {}
    orders = []
    style = [s for s in STYLES[email] if s in instruments]
    days = order_times(rng, rng.randint(*ORDERS_PER_ACCOUNT), now)
    rejected_index = len(days) // 2 if email in WITH_REJECTED_ORDER else None

    for index, day in enumerate(days):
        selling = held and index >= 3 and rng.random() < 0.3
        symbol = rng.choice(sorted(held)) if selling else rng.choice(style)
        instrument_id, exchange = instruments[symbol]
        at = at_market_hours(rng, day, exchange)
        price = price_at(conn, instrument_id, at)
        if price is None:
            continue

        if index == rejected_index:
            quantity = quantity_for(cash * 3, price)
            orders.append(order(instrument_id, "BUY", quantity, price, "FAILED", at))
            continue

        if selling:
            quantity = (held[symbol] * Decimal(str(rng.uniform(0.25, 0.6)))).quantize(QTY, rounding=ROUND_DOWN)
            if quantity <= 0:
                continue
            held[symbol] -= quantity
            cash += (quantity * price).quantize(CENTS, rounding=ROUND_HALF_UP)
            orders.append(order(instrument_id, "SELL", quantity, price, "COMPLETE", at))
        else:
            if cash < MIN_CASH_TO_BUY:
                continue
            quantity = quantity_for(cash * Decimal(str(rng.uniform(*BUY_SHARE_OF_CASH))), price)
            if quantity <= 0:
                continue
            held[symbol] = held.get(symbol, Decimal(0)) + quantity
            cash -= (quantity * price).quantize(CENTS, rounding=ROUND_HALF_UP)
            orders.append(order(instrument_id, "BUY", quantity, price, "COMPLETE", at))
    return orders, cash


def order(instrument_id: int, side: str, quantity: Decimal, price: Decimal, status: str, at: datetime) -> dict:
    return {"instrument_id": instrument_id, "side": side, "quantity": quantity,
            "price": price, "status": status, "at": at}


def reset(conn, account_ids: list[int]) -> None:
    conn.execute(text("DELETE FROM holdings WHERE account_id = ANY(:ids)"), {"ids": account_ids})
    conn.execute(text("DELETE FROM transactions WHERE account_id = ANY(:ids)"), {"ids": account_ids})


def seed(connection_string: str, wipe_first: bool) -> int:
    """Seed the sample accounts. Returns the number of orders written."""
    engine = create_engine(connection_string)
    now = datetime.now(timezone.utc)
    rng = random.Random(RANDOM_SEED)

    with engine.begin() as conn:
        accounts, instruments = load_context(conn)
        missing = [email for email in STARTING_CASH if email not in accounts]
        if missing:
            raise RuntimeError(f"sample accounts missing from the database: {', '.join(missing)}")

        oldest = conn.execute(text("SELECT min(observed_at) FROM instrument_price")).scalar()
        if oldest is None or oldest > now - timedelta(days=HISTORY_DAYS):
            raise RuntimeError(f"less than {HISTORY_DAYS} days of price history; run price_fetcher.py first")

        sample_ids = [accounts[email] for email in STYLES]
        if wipe_first:
            reset(conn, [accounts[email] for email in STARTING_CASH])
            for email, cash in STARTING_CASH.items():
                conn.execute(text("UPDATE account SET cash_balance = :cash WHERE account_id = :id"),
                             {"cash": cash, "id": accounts[email]})
            logger.info("✓ Reset %d accounts to their starting cash", len(STARTING_CASH))
        elif conn.execute(text("SELECT count(*) FROM transactions WHERE account_id = ANY(:ids)"),
                          {"ids": sample_ids}).scalar():
            logger.info("Sample accounts already have orders - nothing to do (use --reset to start over)")
            return 0

        written = 0
        for email in STYLES:
            account_id = accounts[email]
            orders, cash = plan_orders(conn, rng, email, instruments, now)
            for o in orders:
                conn.execute(
                    text("""
                        INSERT INTO transactions
                            (account_id, instrument_id, transaction_type, quantity, price, status, transaction_time)
                        VALUES (:account_id, :instrument_id, :side, :quantity, :price, :status, :at)
                    """),
                    {"account_id": account_id, **o},
                )
            conn.execute(text("UPDATE account SET cash_balance = :cash WHERE account_id = :id"),
                         {"cash": cash, "id": account_id})
            filled = sum(1 for o in orders if o["status"] == "COMPLETE")
            logger.info("  ✓ %-26s %d orders (%d filled), cash left %s", email, len(orders), filled, cash)
            written += len(orders)

        conn.execute(text("DELETE FROM holdings WHERE account_id = ANY(:ids)"), {"ids": sample_ids})
        conn.execute(
            text("""
                INSERT INTO holdings (account_id, instrument_id, quantity, updated_at)
                SELECT account_id, instrument_id,
                       SUM(CASE WHEN transaction_type = 'BUY' THEN quantity ELSE -quantity END),
                       now()
                  FROM transactions
                 WHERE account_id = ANY(:ids) AND status = 'COMPLETE'
                 GROUP BY account_id, instrument_id
                HAVING SUM(CASE WHEN transaction_type = 'BUY' THEN quantity ELSE -quantity END) > 0
            """),
            {"ids": sample_ids},
        )
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed sample orders at real recorded prices.")
    parser.add_argument("--reset", action="store_true",
                        help="wipe orders and holdings of the sample accounts and account 1 first")
    args = parser.parse_args()

    setup_logger()
    logger.info("=" * 70)
    logger.info("SAMPLE ORDER SEEDER")
    logger.info("=" * 70)
    try:
        written = seed(DB_OPERATIONAL, args.reset)
    except Exception as exc:
        logger.error("✗ Seeding failed: %s", exc)
        sys.exit(1)
    if written:
        logger.info("✓ Wrote %d sample orders", written)


if __name__ == "__main__":
    main()
