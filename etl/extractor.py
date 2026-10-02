"""
ETL Extractor Module

Extracts data from the Operational Database (leapfrogsdb).
"""

import logging
from typing import Tuple

import pandas as pd
from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)


class ETLExtractor:
    """Extract data from Operational Database"""
    
    def __init__(self, connection_string: str):
        """Initialize database connection"""
        try:
            self.engine = create_engine(connection_string)
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✓ Connected to Operational DB")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Operational DB: {e}")
            raise
    
    def extract_all_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Extract all source tables from operational database.

        Transactions are restricted to status = 'COMPLETE'; rejected (FAILED)
        and unsettled (PENDING) orders are excluded so they do not inflate
        analytics volume.

        Returns:
            Tuple of (transactions_df, stock_df, exchange_df, account_df)
        """
        logger.info("=" * 70)
        logger.info("PHASE 1: EXTRACT")
        logger.info("=" * 70)
        
        try:
            # Extract transactions. Only settled trades belong in analytics:
            # FAILED orders were rejected and PENDING ones have not settled, so
            # counting either would overstate volume on the dashboards.
            logger.info("Extracting: transactions (status = COMPLETE)")
            transactions_df = pd.read_sql(
                "SELECT * FROM transactions WHERE status = 'COMPLETE'", self.engine
            )
            logger.info(f"  ✓ Extracted {len(transactions_df)} completed transaction records")
            
            # Extract instrument
            logger.info("Extracting: instrument")
            stock_df = pd.read_sql("SELECT * FROM instrument", self.engine)
            logger.info(f"  ✓ Extracted {len(stock_df)} instrument records")
            
            # Extract exchange
            logger.info("Extracting: exchange")
            exchange_df = pd.read_sql("SELECT * FROM exchange", self.engine)
            logger.info(f"  ✓ Extracted {len(exchange_df)} exchange records")
            
            # Extract account
            logger.info("Extracting: account")
            account_df = pd.read_sql("SELECT * FROM account", self.engine)
            logger.info(f"  ✓ Extracted {len(account_df)} account records")
            
            logger.info("✓ EXTRACT PHASE COMPLETE\n")
            return transactions_df, stock_df, exchange_df, account_df
        
        except Exception as e:
            logger.error(f"✗ Extract failed: {e}")
            raise
        finally:
            self.engine.dispose()
