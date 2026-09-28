#!/bin/bash
# First-boot step: create analytics tables inside leap_analytics.
# capstone-analytics-schema.sql is mounted at /analytics-schema.sql.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "leap_analytics" \
  -f /analytics-schema.sql
