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
    
    def extract_all_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Extract all source tables from operational database.

        transactions_df is restricted to status = 'COMPLETE'; rejected, pending,
        cancelled and expired orders are excluded so they do not inflate
        analytics volume. orders_df has every order in every status, for the
        order-outcome tables.

        Returns:
            Tuple of (transactions_df, stock_df, exchange_df, account_df, orders_df)
        """
        logger.info("=" * 70)
        logger.info("PHASE 1: EXTRACT")
        logger.info("=" * 70)
        
        try:
            # Extract transactions. Only settled trades belong in analytics:
            # FAILED orders were rejected and PENDING ones have not settled, so
            # counting either would overstate volume on the dashboards.
            # A pending order trades when it fills, not when it was placed, so
            # its fill time stands in for transaction_time (older rows have no
            # filled_at and filled at transaction_time).
            logger.info("Extracting: transactions (status = COMPLETE)")
            transactions_df = pd.read_sql(
                """
                SELECT transaction_id, account_id, instrument_id, transaction_type,
                       quantity, price, status,
                       COALESCE(filled_at, transaction_time) AS transaction_time
                FROM transactions
                WHERE status = 'COMPLETE'
                """,
                self.engine,
            )
            logger.info(f"  ✓ Extracted {len(transactions_df)} completed transaction records")

            # Extract every order, whatever became of it, for fact_orders and
            # order_outcomes. This is the only place cancelled, expired and
            # still-pending orders reach analytics; volume above stays COMPLETE only.
            logger.info("Extracting: orders (every status)")
            orders_df = pd.read_sql(
                """
                SELECT transaction_id, account_id, instrument_id, transaction_type,
                       order_type, time_in_force, status, quantity, limit_price, price,
                       transaction_time AS placed_at,
                       CASE WHEN status = 'COMPLETE'
                            THEN COALESCE(filled_at, transaction_time) END AS filled_at,
                       closed_at, expires_at
                FROM transactions
                """,
                self.engine,
            )
            by_status = orders_df['status'].value_counts().to_dict() if not orders_df.empty else {}
            logger.info(f"  ✓ Extracted {len(orders_df)} orders {by_status}")

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
            return transactions_df, stock_df, exchange_df, account_df, orders_df
        
        except Exception as e:
            logger.error(f"✗ Extract failed: {e}")
            raise
        finally:
            self.engine.dispose()
