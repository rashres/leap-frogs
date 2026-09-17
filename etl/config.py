"""
ETL Pipeline Configuration

Database connection strings for Operational and Analytics databases.
Credentials loaded from environment variables (.env file or system env).
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import quote

# Load .env file from the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Database credentials (from environment variables)
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

# URL-encode password for special characters (like ! in neued4!)
DB_PASSWORD_ENCODED = quote(DB_PASSWORD, safe='')

# Operational Database (Source) - leapfrogsdb
DB_OPERATIONAL = f"postgresql://{DB_USER}:{DB_PASSWORD_ENCODED}@{DB_HOST}:{DB_PORT}/leapfrogsdb"

# Analytics Database (Target) - leap_analyticscat > etl/.env << 'EOF'
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
EOF
DB_ANALYTICS = f"postgresql://{DB_USER}:{DB_PASSWORD_ENCODED}@{DB_HOST}:{DB_PORT}/leap_analytics"
