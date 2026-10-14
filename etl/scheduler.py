#!/usr/bin/env python3
"""
Runs the ETL pipeline now, then again every ETL_INTERVAL_MINUTES (default 15),
so the analytics dashboard's "Data as of" stays recent.

A failed run is logged and retried at the next interval; the previous analytics
data stays in place because each load is a single transaction.

Execution:
    python scheduler.py            # every 15 minutes
    ETL_INTERVAL_MINUTES=5 python scheduler.py
Stop with Ctrl+C (or `docker compose stop etl-scheduler`).
"""

import os
import signal
import threading
import time
from datetime import datetime, timedelta

from main import logger, run_etl_pipeline

stop = threading.Event()


def interval_minutes() -> float:
    raw = os.getenv("ETL_INTERVAL_MINUTES", "15")
    try:
        minutes = float(raw)
    except ValueError:
        raise SystemExit(f"ETL_INTERVAL_MINUTES must be a number, got {raw!r}")
    if minutes < 1:
        raise SystemExit("ETL_INTERVAL_MINUTES must be at least 1")
    return minutes


def main() -> None:
    minutes = interval_minutes()
    # Docker stops containers with SIGTERM, which Python ignores when it runs as PID 1.
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    logger.info(f"ETL scheduler started: refreshing analytics every {minutes:g} minutes")

    while not stop.is_set():
        started = time.monotonic()
        try:
            run_etl_pipeline()
        except Exception:
            logger.warning("ETL run failed; will try again at the next interval")
        wait = max(0.0, minutes * 60 - (time.monotonic() - started))
        logger.info(f"Next ETL run at {(datetime.now() + timedelta(seconds=wait)):%H:%M:%S}")
        stop.wait(wait)

    logger.info("ETL scheduler stopped")


if __name__ == "__main__":
    main()
