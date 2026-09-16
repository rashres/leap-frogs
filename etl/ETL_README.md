# ETL Pipeline

Extract trading data from `leapfrogsdb` → Transform with pandas → Load into `leap_analytics`

## Quick Start

### 1. Set environment variables (`.env` file)
```bash
# Create .env file in project root with:
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
```

### 2. Install dependencies
```bash
pip install -r etl/requirements-etl.txt
```

### 3. Start databases
```bash
docker-compose -f docker-compose-etl.yml up -d
sleep 30
```

### 4. Run ETL
```bash
python etl/main.py
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
**User & Password:** Set in `.env` file or environment variables

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
docker-compose -f docker-compose-etl.yml down -v
docker-compose -f docker-compose-etl.yml up -d
sleep 30
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

---

## File Reference

- **`.env.example`** - Copy to `.env` and fill in database credentials