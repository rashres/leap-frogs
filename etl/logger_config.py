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
    # LOG_FILE lets a container (or a read-only checkout) redirect the log.
    log_file = os.getenv(
        'LOG_FILE', os.path.join(os.path.dirname(__file__), 'etl_pipeline.log')
    )

    handlers = [logging.StreamHandler(sys.stdout)]

    # Logging to stdout must never be lost just because the log file cannot be
    # opened - read-only mounts and unwritable directories are both normal.
    try:
        handlers.insert(0, logging.FileHandler(log_file))
        file_error = None
    except OSError as exc:
        file_error = exc

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )

    logger = logging.getLogger(__name__)
    if file_error is not None:
        logger.warning(
            "File logging disabled (%s): %s. Console logging still active.",
            log_file, file_error
        )
    return logger
