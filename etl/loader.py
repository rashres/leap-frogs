"""
ETL Loader Module

Loads transformed data into the Analytics Database (leap_analytics).
"""

import logging

import pandas as pd
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)


class ETLLoader:
    """Load transformed data into Analytics Database"""
    
    def __init__(self, connection_string: str):
        """Initialize database connection"""
        try:
            self.engine = create_engine(connection_string)
            logger.info(f"✓ Connected to Analytics DB")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Analytics DB: {e}")
            raise
    
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
        finally:
            self.engine.dispose()
    
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
