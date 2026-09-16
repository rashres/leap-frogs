"""
ETL Pipeline Configuration

Database connection strings for Operational and Analytics databases.
Credentials loaded from environment variables (.env file or system env).
"""

import os

# Database credentials (from environment variables)
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

# Operational Database (Source) - leapfrogsdb
DB_OPERATIONAL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/leapfrogsdb"

# Analytics Database (Target) - leap_analytics
DB_ANALYTICS = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/leap_analytics"
