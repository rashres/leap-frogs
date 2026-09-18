# ETL Pipeline

Extract trading data from `leapfrogsdb` → Transform with pandas → Load into `leap_analytics`

## Quick Start

### 1. Set environment variables (repo-root `.env`)
```bash
cp .env.example .env
```

That one file is used by docker-compose, the ETL, and the visualizations. It is already gitignored.

### 2. Install dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r etl/requirements-etl.txt
```

### 3. Start databases
```bash
docker-compose up -d
```

Wait until Postgres is healthy (about 10–30 seconds on first start).

If this Postgres volume was created before analytics lived in `leap_analytics`, the ETL will create that database and tables on the next run. For a clean init instead:

```bash
docker-compose down -v
docker-compose up -d
```

### 4. Run ETL
```bash
python etl/main.py
```

Or from the `etl/` directory:

```bash
python main.py
```

### 5. Check results
```bash
# View logs
tail -f etl/etl_pipeline.log

# Query analytics data
psql -h localhost -p 5432 -U postgres -d leap_analytics -c "SELECT COUNT(*) FROM fact_trades;"
```

---

## What It Does

| Phase | Input | Output |
|-------|-------|--------|
| **Extract** | Reads from `leapfrogsdb` (transactions, stock, exchange, account) | 4 pandas DataFrames |
| **Transform** | Joins & aggregates data | 4 analytics tables (fact_trades, trading_volume, instrument_activity, client_activity) |
| **Load** | Truncates existing data, inserts new | Data in `leap_analytics` database |
| **Verify** | Counts rows in each table | Logs row counts |

---

## Database Connections

**Source:** `leapfrogsdb` on localhost:5432  
**Target:** `leap_analytics` on localhost:5432  
**User & Password:** Set in the repo-root `.env` file

---

## Code Structure

```
etl/
├── main.py              # Entry point
├── config.py            # DB connection strings
├── logger_config.py     # Logging setup
├── extractor.py         # Read from source DB
├── transformer.py       # Transform logic
├── loader.py            # Write to target DB
├── requirements-etl.txt # Dependencies
└── etl_pipeline.log     # Generated logs
```

---

## Troubleshooting

**Databases won't start:**
```bash
docker-compose down -v
docker-compose up -d
```

**Python dependencies not found:**
```bash
pip install --upgrade pip
pip install -r etl/requirements-etl.txt
```

**No data in analytics tables:**
```bash
# Check source DB has data
psql -h localhost -p 5432 -U postgres -d leapfrogsdb -c "SELECT COUNT(*) FROM transactions;"

# Re-run ETL
python etl/main.py
```

**`password authentication failed`:**  
Root `.env` `DB_PASSWORD` must match the password Postgres was created with (default `postgres`). If you changed it after the first `docker-compose up`, recreate the volume: `docker-compose down -v && docker-compose up -d`.

**`database "leap_analytics" does not exist`:**  
Re-run the pipeline; the loader now creates it. Or recreate the container with `docker-compose down -v && docker-compose up -d`.

**pandas / Python 3.14:** Old pinned wheels (pandas 2.1.4) do not install on current Python. `requirements-etl.txt` uses minimum versions so `pip install` can pull a compatible pandas.

---

## File Reference

- **`.env.example`** — Copy to `.env` in the repo root and fill in database credentials
