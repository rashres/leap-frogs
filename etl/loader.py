"""
ETL Loader Module

Loads transformed data into the Analytics Database (leap_analytics).
"""

import logging
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from config import ANALYTICS_DB_NAME, ANALYTICS_SCHEMA_PATH, DB_ADMIN, DB_OPERATIONAL

logger = logging.getLogger(__name__)


class ETLLoader:
    """Load transformed data into Analytics Database"""

    def __init__(self, connection_string: str):
        """Create the analytics database/schema if needed, then connect."""
        try:
            self._ensure_analytics_database()
            self.engine = create_engine(connection_string)
            self._ensure_analytics_schema()
            logger.info("✓ Connected to Analytics DB")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Analytics DB: {e}")
            raise

    def _ensure_analytics_database(self) -> None:
        """Create leap_analytics if docker init never created it."""
        last_error = None
        for url in (DB_ADMIN, DB_OPERATIONAL):
            admin_engine = create_engine(url, isolation_level="AUTOCOMMIT")
            try:
                with admin_engine.connect() as conn:
                    exists = conn.execute(
                        text("SELECT 1 FROM pg_database WHERE datname = :name"),
                        {"name": ANALYTICS_DB_NAME},
                    ).scalar()
                    if not exists:
                        conn.execute(text(f'CREATE DATABASE "{ANALYTICS_DB_NAME}"'))
                        logger.info(f"  ✓ Created database {ANALYTICS_DB_NAME}")
                return
            except Exception as e:
                last_error = e
            finally:
                admin_engine.dispose()
        raise last_error

    def _ensure_analytics_schema(self) -> None:
        """
        Create any analytics tables that are not present yet.

        The schema file is all CREATE ... IF NOT EXISTS, so it runs on every
        refresh: a table added to it later (fact_orders, order_outcomes) reaches
        an analytics database that already exists, and existing tables are left alone.
        """
        schema_path = Path(ANALYTICS_SCHEMA_PATH)
        if not schema_path.exists():
            raise FileNotFoundError(f"Analytics schema not found: {schema_path}")

        schema_sql = schema_path.read_text()
        raw = self.engine.raw_connection()
        try:
            with raw.cursor() as cur:
                cur.execute(schema_sql)
            raw.commit()
            logger.info("  ✓ Analytics schema up to date")
        finally:
            raw.close()

    def load_all(
        self,
        fact_trades: pd.DataFrame,
        trading_volume: pd.DataFrame,
        instrument_activity: pd.DataFrame,
        client_activity: pd.DataFrame,
        fact_orders: pd.DataFrame,
        order_outcomes: pd.DataFrame
    ) -> None:
        """
        Replace all analytics tables with the freshly transformed data (full refresh).

        The truncate and every insert run in ONE transaction: the dashboard reads
        either the previous data or the new data, never empty tables mid-refresh,
        and a failed load rolls back and leaves the previous data in place.
        """
        logger.info("=" * 70)
        logger.info("PHASE 3: LOAD")
        logger.info("=" * 70)

        tables = [
            ('fact_trades', fact_trades),
            ('trading_volume', trading_volume),
            ('instrument_activity', instrument_activity),
            ('client_activity', client_activity),
            ('fact_orders', fact_orders),
            ('order_outcomes', order_outcomes),
        ]
        try:
            with self.engine.begin() as conn:
                logger.info("Truncating existing data...")
                conn.execute(text("TRUNCATE TABLE " + ", ".join(name for name, _ in tables)))
                for name, frame in tables:
                    frame.to_sql(name, conn, if_exists='append', index=False)
                    logger.info(f"  ✓ Loaded {len(frame)} rows into {name}")
            logger.info("✓ LOAD PHASE COMPLETE (committed)\n")

        except Exception as e:
            # The first line is enough; the rest is every row's parameters.
            logger.error(f"✗ Load failed, previous analytics data kept: {str(e).splitlines()[0]}")
            raise

    def verify_load(self) -> None:
        """Verify data was loaded correctly"""
        logger.info("=" * 70)
        logger.info("VERIFICATION")
        logger.info("=" * 70)

        try:
            queries = [
                ("fact_trades", "SELECT COUNT(*) as count FROM fact_trades"),
                ("trading_volume", "SELECT COUNT(*) as count FROM trading_volume"),
                ("instrument_activity", "SELECT COUNT(*) as count FROM instrument_activity"),
                ("client_activity", "SELECT COUNT(*) as count FROM client_activity"),
                ("fact_orders", "SELECT COUNT(*) as count FROM fact_orders"),
                ("order_outcomes", "SELECT COUNT(*) as count FROM order_outcomes"),
            ]

            for table_name, query in queries:
                result = pd.read_sql(query, self.engine)
                count = result['count'].iloc[0]
                logger.info(f"  {table_name}: {count} rows")

            logger.info("✓ VERIFICATION COMPLETE\n")

        except Exception as e:
            logger.error(f"✗ Verification failed: {e}")
            raise

    def close(self) -> None:
        """Dispose the analytics connection pool."""
        if getattr(self, "engine", None) is not None:
            self.engine.dispose()
