#!/usr/bin/env python3
"""
LEAP Trading Platform - ETL Pipeline

Purpose:
    Extract data from Operational Database (leapfrogsdb)
    Transform using Pandas
    Load into Analytics Database (leap_analytics)

Execution:
    python main.py

Author: Leap Frogs
Date: 2026-09-16
Version: 1.0 (MVP - Simple Batch ETL)
"""

import sys
from datetime import datetime

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from config import DB_OPERATIONAL, DB_ANALYTICS
from logger_config import setup_logger
from extractor import ETLExtractor
from transformer import ETLTransformer
from loader import ETLLoader

logger = setup_logger()


def run_etl_pipeline() -> None:
    """Execute complete ETL pipeline: Extract → Transform → Load → Verify"""
    
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
