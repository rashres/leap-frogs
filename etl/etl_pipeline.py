#!/usr/bin/env python3
"""
LeapFrogs Trading Platform - ETL Pipeline Script

Purpose:
    Extract data from Operational Database (PostgreSQL 1)
    Transform using Pandas
    Load into Analytics Database (PostgreSQL 2)

Author: Leap Frogs
Date: 2026-09-15
Version: 1.0 (MVP - Simple Batch ETL)

Dependencies:
    pip install pandas sqlalchemy psycopg2-binary python-dotenv
"""

import logging
import sys
import os
from datetime import datetime
from typing import Optional, Tuple

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database Connection Strings (from environment variables)
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

DB_OPERATIONAL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/leapfrogsdb"
DB_ANALYTICS = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/leap_analytics"

# Logging Configuration
import os
log_file = os.path.join(os.path.dirname(__file__), 'etl_pipeline.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


# ============================================================================
# PART 1: EXTRACT
# ============================================================================

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


# ============================================================================
# PART 2: TRANSFORM
# ============================================================================

class ETLTransformer:
    """Transform extracted data for analytics database"""
    
    @staticmethod
    def build_fact_trades(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame,
        account_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build denormalized fact_trades table by joining all dimensions.
        
        Transformations:
        - Calculate amount = quantity × price
        - Extract trade_date from transaction_time
        - Derive segment (hardcoded for MVP)
        - Add refreshed_at timestamp
        """
        logger.info("  Transforming: fact_trades (denormalized)")
        
        # Join transactions with stock
        df = transactions_df.merge(
            stock_df,
            on='stock_id',
            how='left',
            suffixes=('', '_stock')
        )
        
        # Join with exchange
        df = df.merge(
            exchange_df,
            on='exchange_id',
            how='left',
            suffixes=('', '_exchange')
        )
        
        # Rename columns for analytics schema
        df = df.rename(columns={
            'name_stock': 'stock_name',
            'name_exchange': 'exchange_name',
            'symbol': 'symbol',
            'transaction_time': 'transactions_time'
        })
        
        # Calculate derived fields
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        df['trade_date'] = pd.to_datetime(df['transactions_time']).dt.date
        df['segment'] = 'Standard'  # Hardcoded for MVP; could derive from account
        df['refreshed_at'] = datetime.now()
        
        # Select only required columns
        fact_trades = df[[
            'transaction_id', 'account_id', 'symbol', 'segment',
            'stock_name', 'exchange_name', 'transaction_type',
            'quantity', 'price', 'amount', 'trade_date',
            'transactions_time', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(fact_trades)} fact_trades rows")
        return fact_trades
    
    @staticmethod
    def build_trading_volume(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated trading_volume table.
        
        Aggregations:
        - GROUP BY symbol
        - SUM quantity BY transaction_type (BUY vs SELL)
        - Calculate notional = SUM(quantity × price)
        """
        logger.info("  Transforming: trading_volume (aggregated)")
        
        # Join transactions with stock
        df = transactions_df.merge(stock_df, on='stock_id', how='left')
        
        # Calculate amount for notional
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        
        # Group by symbol and transaction type
        grouped = df.groupby(['symbol', 'transaction_type']).agg({
            'quantity': 'sum',
            'amount': 'sum'
        }).reset_index()
        
        # Pivot to get BUY and SELL columns
        pivot = grouped.pivot(
            index='symbol',
            columns='transaction_type',
            values='quantity'
        ).fillna(0)
        
        # Calculate totals
        trading_volume = pd.DataFrame({
            'symbol': pivot.index,
            'buy_volume': pivot.get('BUY', 0),
            'sell_volume': pivot.get('SELL', 0)
        }).reset_index(drop=True)
        
        trading_volume['total_volume'] = \
            trading_volume['buy_volume'] + trading_volume['sell_volume']
        
        # Calculate notional (for each symbol)
        notional_calc = df.groupby('symbol')['amount'].sum().reset_index()
        notional_calc.columns = ['symbol', 'notional']
        
        trading_volume = trading_volume.merge(
            notional_calc,
            on='symbol',
            how='left'
        )
        
        # Add stock name from stock table
        trading_volume = trading_volume.merge(
            stock_df[['symbol', 'name']].drop_duplicates(),
            on='symbol',
            how='left'
        )
        trading_volume = trading_volume.rename(columns={'name': 'stock_name'})
        
        # Add timestamp
        trading_volume['refreshed_at'] = datetime.now()
        
        # Select and reorder columns
        trading_volume = trading_volume[[
            'symbol', 'stock_name', 'buy_volume', 'sell_volume',
            'total_volume', 'notional', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(trading_volume)} trading_volume rows")
        return trading_volume
    
    @staticmethod
    def build_instrument_activity(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated instrument_activity table.
        
        Aggregations:
        - GROUP BY symbol
        - COUNT total trades
        - COUNT DISTINCT clients
        - COUNT BUY vs SELL trades
        """
        logger.info("  Transforming: instrument_activity (aggregated)")
        
        # Join transactions with stock
        df = transactions_df.merge(stock_df, on='stock_id', how='left')
        
        # Group by symbol and calculate metrics
        activity = df.groupby('symbol').agg({
            'transaction_id': 'count',           # Total trades
            'account_id': 'nunique',              # Unique clients
        }).reset_index()
        
        activity.columns = ['symbol', 'trades', 'clients']
        
        # Count BUY and SELL trades
        buy_sell_counts = df.groupby(['symbol', 'transaction_type']).size().unstack(
            fill_value=0
        ).reset_index()
        
        activity = activity.merge(
            buy_sell_counts,
            on='symbol',
            how='left'
        )
        
        # Ensure BUY and SELL columns exist (handle case where one type missing)
        activity['buy_trades'] = activity.get('BUY', 0)
        activity['sell_trades'] = activity.get('SELL', 0)
        
        # Add stock name
        activity = activity.merge(
            stock_df[['symbol', 'name']].drop_duplicates(),
            on='symbol',
            how='left'
        )
        activity = activity.rename(columns={'name': 'stock_name'})
        
        # Add timestamp
        activity['refreshed_at'] = datetime.now()
        
        # Select and reorder columns
        instrument_activity = activity[[
            'symbol', 'stock_name', 'trades', 'clients',
            'buy_trades', 'sell_trades', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(instrument_activity)} instrument_activity rows")
        return instrument_activity
    
    @staticmethod
    def build_client_activity(
        transactions_df: pd.DataFrame,
        account_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated client_activity table by month and segment.
        
        Aggregations:
        - GROUP BY YEAR_MONTH, segment
        - COUNT DISTINCT clients per month
        - COUNT and SUM trades/volume per month
        - Calculate average trades per client
        """
        logger.info("  Transforming: client_activity (aggregated)")
        
        # Join with account
        df = transactions_df.merge(account_df, on='account_id', how='left')
        
        # Extract year-month
        df['transaction_time'] = pd.to_datetime(df['transaction_time'])
        df['month'] = df['transaction_time'].dt.to_period('M').dt.to_timestamp()
        
        # Add segment (hardcoded for MVP)
        df['segment'] = 'Standard'
        
        # Calculate amount for volume
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        
        # Group by month and segment
        client_activity = df.groupby(['month', 'segment']).agg({
            'account_id': 'nunique',           # Active clients
            'transaction_id': 'count',         # Number of trades
            'quantity': 'sum'                  # Total volume
        }).reset_index()
        
        client_activity.columns = ['month', 'segment', 'active_clients', 'trades', 'volume']
        
        # Calculate average trades per client
        client_activity['avg_trades_per_client'] = (
            client_activity['trades'] / client_activity['active_clients']
        ).round(2)
        
        # Add timestamp
        client_activity['refreshed_at'] = datetime.now()
        
        # Ensure month is DATE type
        client_activity['month'] = client_activity['month'].dt.date
        
        logger.info(f"    ✓ Created {len(client_activity)} client_activity rows")
        return client_activity
    
    @staticmethod
    def transform_all(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame,
        account_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Execute all transformations"""
        logger.info("=" * 70)
        logger.info("PHASE 2: TRANSFORM")
        logger.info("=" * 70)
        
        try:
            fact_trades = ETLTransformer.build_fact_trades(
                transactions_df, stock_df, exchange_df, account_df
            )
            
            trading_volume = ETLTransformer.build_trading_volume(
                transactions_df, stock_df
            )
            
            instrument_activity = ETLTransformer.build_instrument_activity(
                transactions_df, stock_df
            )
            
            client_activity = ETLTransformer.build_client_activity(
                transactions_df, account_df
            )
            
            logger.info("✓ TRANSFORM PHASE COMPLETE\n")
            return fact_trades, trading_volume, instrument_activity, client_activity
        
        except Exception as e:
            logger.error(f"✗ Transform failed: {e}")
            raise


# ============================================================================
# PART 3: LOAD
# ============================================================================

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


# ============================================================================
# MAIN ETL ORCHESTRATOR
# ============================================================================

def run_etl_pipeline() -> None:
    """Execute complete ETL pipeline: Extract → Transform → Load"""
    
    logger.info("\n" + "=" * 70)
    logger.info("LEAP TRADING PLATFORM - ETL PIPELINE")
    logger.info(f"Start Time: {datetime.now()}")
    logger.info("=" * 70 + "\n")
    
    try:
        # Step 1: EXTRACT
        extractor = ETLExtractor(DB_OPERATIONAL)
        transactions_df, stock_df, exchange_df, account_df = extractor.extract_all_data()
        
        # Step 2: TRANSFORM
        fact_trades, trading_volume, instrument_activity, client_activity = \
            ETLTransformer.transform_all(
                transactions_df, stock_df, exchange_df, account_df
            )
        
        # Step 3: LOAD
        loader = ETLLoader(DB_ANALYTICS)
        loader.load_all(fact_trades, trading_volume, instrument_activity, client_activity)
        
        # Step 4: VERIFY
        loader.verify_load()
        
        logger.info("=" * 70)
        logger.info("✓ ETL PIPELINE COMPLETED SUCCESSFULLY")
        logger.info(f"End Time: {datetime.now()}")
        logger.info("=" * 70 + "\n")
    
    except Exception as e:
        logger.error("\n" + "=" * 70)
        logger.error("✗ ETL PIPELINE FAILED")
        logger.error(f"Error: {e}")
        logger.error("=" * 70 + "\n")
        sys.exit(1)


if __name__ == "__main__":
    run_etl_pipeline()
