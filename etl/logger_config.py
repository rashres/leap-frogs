"""
ETL Pipeline Logging Configuration

Sets up logging to both file and console output.
"""

import logging
import sys
import os


def setup_logger():
    """
    Configure logging for the ETL pipeline.
    
    Outputs:
    - File: etl_pipeline.log (in same directory as script)
    - Console: stdout
    
    Returns:
        logging.Logger: Configured logger instance
    """
    log_file = os.path.join(os.path.dirname(__file__), 'etl_pipeline.log')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)
