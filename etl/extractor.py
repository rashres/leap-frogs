"""
ETL Extractor Module

Extracts data from the Operational Database (leapfrogsdb).
"""

import logging
from typing import Tuple

import pandas as pd
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)


class ETLExtractor:
    """Extract data from Operational Database"""
    
    def __init__(self, connection_string: str):
        """Initialize database connection"""
        try:
            self.engine = create_engine(connection_string)
            logger.info(f"✓ Connected to Operational DB")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Operational DB: {e}")
            raise
    
    def extract_all_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Extract all source tables from operational database.
        
        Returns:
            Tuple of (transactions_df, stock_df, exchange_df, account_df)
        """
        logger.info("=" * 70)
        logger.info("PHASE 1: EXTRACT")
        logger.info("=" * 70)
        
        try:
            # Extract transactions
            logger.info("Extracting: transactions")
            transactions_df = pd.read_sql("SELECT * FROM transactions", self.engine)
            logger.info(f"  ✓ Extracted {len(transactions_df)} transaction records")
            
            # Extract stock
            logger.info("Extracting: stock")
            stock_df = pd.read_sql("SELECT * FROM stock", self.engine)
            logger.info(f"  ✓ Extracted {len(stock_df)} stock records")
            
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
