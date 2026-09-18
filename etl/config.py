"""
ETL Pipeline Configuration

Database connection strings for Operational and Analytics databases.
Credentials loaded from environment variables (.env file or system env).
"""

import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Repo-root .env — shared with docker-compose and visualizations
load_dotenv(PROJECT_ROOT / ".env")

# Accept both ETL (DB_*) and docker-compose (POSTGRES_*) names.
# Default password matches docker-compose.yml (${DB_PASSWORD:-postgres}).
DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER") or "postgres"
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD") or "postgres"
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

OPERATIONAL_DB_NAME = os.getenv("DB_OPERATIONAL_NAME") or os.getenv("POSTGRES_DB") or "leapfrogsdb"
ANALYTICS_DB_NAME = os.getenv("DB_ANALYTICS_NAME", "leap_analytics")

ANALYTICS_SCHEMA_PATH = PROJECT_ROOT / "database" / "capstone-analytics-schema.sql"


def _url(database: str) -> str:
    return (
        f"postgresql://{quote_plus(DB_USER)}:{quote_plus(DB_PASSWORD)}"
        f"@{DB_HOST}:{DB_PORT}/{database}"
    )


# Operational Database (Source) - leapfrogsdb
DB_OPERATIONAL = _url(OPERATIONAL_DB_NAME)

# Analytics Database (Target) - leap_analytics
DB_ANALYTICS = _url(ANALYTICS_DB_NAME)

# Admin connection used to CREATE DATABASE if the analytics DB is missing
DB_ADMIN = _url("postgres")
