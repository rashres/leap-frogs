# Python image for the ETL pipeline and the yfinance price fetcher, so neither
# has to be installed on the host.
#
# Build context is the REPO ROOT, not etl/: config.py resolves PROJECT_ROOT as
# the parent of the code directory and loader.py reads the analytics schema
# from PROJECT_ROOT/database, so both have to exist in the image.
FROM python:3.12-slim

WORKDIR /app

# Installed first so the layer is cached unless requirements change.
COPY etl/requirements-etl.txt .
RUN pip install --no-cache-dir -r requirements-etl.txt

# /app -> code, /database -> schema files (PROJECT_ROOT resolves to /)
COPY etl/ /app/
COPY database/ /database/

# /app may be read-only; keep the log somewhere always writable.
ENV LOG_FILE=/tmp/etl_pipeline.log

# Inside the compose network Postgres is reachable by service name on its own
# port, not via the host's published 8100.
ENV DB_HOST=postgres \
    DB_PORT=5432

CMD ["python", "price_fetcher.py"]
