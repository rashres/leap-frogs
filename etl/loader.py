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
        """Create analytics tables if they are not already present."""
        schema_path = Path(ANALYTICS_SCHEMA_PATH)
        if not schema_path.exists():
            raise FileNotFoundError(f"Analytics schema not found: {schema_path}")

        with self.engine.connect() as conn:
            exists = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "  SELECT FROM information_schema.tables "
                    "  WHERE table_schema = 'public' AND table_name = 'fact_trades'"
                    ")"
                )
            ).scalar()

        if exists:
            return

        schema_sql = schema_path.read_text()
        raw = self.engine.raw_connection()
        try:
            with raw.cursor() as cur:
                cur.execute(schema_sql)
            raw.commit()
            logger.info("  ✓ Applied analytics schema")
        finally:
            raw.close()

    def load_all(
        self,
        fact_trades: pd.DataFrame,
        trading_volume: pd.DataFrame,
        instrument_activity: pd.DataFrame,
        client_activity: pd.DataFrame
    ) -> None:
        """Load all transformed tables into analytics database"""
        logger.info("=" * 70)
        logger.info("PHASE 3: LOAD")
        logger.info("=" * 70)

        try:
            # Truncate existing data (full refresh)
            logger.info("Truncating existing data...")
            with self.engine.connect() as conn:
                conn.execute(text("TRUNCATE TABLE fact_trades CASCADE"))
                conn.execute(text("TRUNCATE TABLE trading_volume CASCADE"))
                conn.execute(text("TRUNCATE TABLE instrument_activity CASCADE"))
                conn.execute(text("TRUNCATE TABLE client_activity CASCADE"))
                conn.commit()
            logger.info("  ✓ Truncated all analytics tables")

            # Load fact_trades
            logger.info("Loading: fact_trades")
            fact_trades.to_sql(
                'fact_trades',
                self.engine,
                if_exists='append',
                index=False
            )
            logger.info(f"  ✓ Loaded {len(fact_trades)} rows into fact_trades")

            # Load trading_volume
            logger.info("Loading: trading_volume")
            trading_volume.to_sql(
                'trading_volume',
                self.engine,
                if_exists='append',
                index=False
            )
            logger.info(f"  ✓ Loaded {len(trading_volume)} rows into trading_volume")

            # Load instrument_activity
            logger.info("Loading: instrument_activity")
            instrument_activity.to_sql(
                'instrument_activity',
                self.engine,
                if_exists='append',
                index=False
            )
            logger.info(f"  ✓ Loaded {len(instrument_activity)} rows into instrument_activity")

            # Load client_activity
            logger.info("Loading: client_activity")
            client_activity.to_sql(
                'client_activity',
                self.engine,
                if_exists='append',
                index=False
            )
            logger.info(f"  ✓ Loaded {len(client_activity)} rows into client_activity")

            logger.info("✓ LOAD PHASE COMPLETE\n")

        except Exception as e:
            logger.error(f"✗ Load failed: {e}")
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
