# Leap Frogs - v1.0.0

A trading platform and analytics system built for the Leap Frogs capstone project.

## 📋 Project Overview

**Leap Frogs** is a stock trading platform with real-time analytics and visualization capabilities. It consists of three main components:

1. **Java Trading Engine** - Interactive buy/sell trading with order validation
2. **ETL Pipeline** - Extract trading data from source DB, transform, and load into analytics DB
3. **Analytics & Visualizations** - Generate insights and charts from trading data

## 👥 Team

- Jesse Marasigan
- Rahul Shrestha
- Jocelyn Vazquez
- Kadija Bennington
- Rohin Raina

## 🌳 Branching Strategy

We use **Gitflow** to keep things organized:
- `main` → Stable, production-ready code
- `develop` → Integration branch for ongoing work
- `feature/` → Individual feature branches (merged back when done)

---

## 🏗️ Architecture

### Java Trading Engine (`src/main/java`)
- **Account** - Manages client funds and balance
- **Holding** - Tracks stock positions
- **Instrument** - Stock metadata (symbol, name, price)
- **Order** - Buy/sell order model
- **OrderValidator** - Validates trades (sufficient funds, etc.)
- **OrderExecutor** - Executes trades and updates holdings
- **Main** - Interactive demo showing trading workflow

Market prices are **not** simulated in Java. `etl/price_fetcher.py` pulls them
from Yahoo Finance into `instrument.last_price`, and orders are priced from
that column at the moment they are created.

### Database Layer (`database/`)
- **leapfrogsdb** - Source database (accounts, transactions, instruments)
- **leap_analytics** - Target database (aggregated analytics tables)
- Schema files: `capstone-mvp-schema.sql`, `capstone-analytics-schema.sql`, `rbac-schema.sql`, `rbac-seed.sql`

### ETL Pipeline (`etl/`)
Extract → Transform → Load trading data into analytics database.

| Phase | What It Does |
|-------|-------------|
| **Extract** | Reads transactions, accounts, instruments from `leapfrogsdb` |
| **Transform** | Joins & aggregates into analytics tables |
| **Load** | Writes to `leap_analytics` (trading_volume, instrument_activity, client_activity, fact_trades) |
| **Verify** | Logs row counts to confirm success |

### Analytics & Visualizations (`visualizations/`)
- **insights-viz.py** - Queries analytics DB and generates matplotlib charts:
  - Trading volume by symbol (bar chart)
  - Most active instruments (top 10)
  - Client activity trends over time (line chart)
- **test_insights_viz.py** - Unit tests with mocked database connections

---

## ⚡ Quick Start

### 1. Setup Environment
```bash
# Clone repo and cd to it
git clone <repo>
cd leap-frogs

# Copy .env template
cp .env.example .env

# Fill in credentials in .env
# DB_HOST, DB_PORT, POSTGRES_USER, POSTGRES_PASSWORD, etc.
```

### 2. Install Dependencies
```bash
# Java: Use Maven (pom.xml)
mvn clean install

# Python (ETL + Visualizations)
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r etl/requirements-etl.txt
pip install psycopg2-binary pandas matplotlib python-dotenv
```

### 3. Start Databases
```bash
docker-compose up -d
# Wait ~10-30 seconds for Postgres to be healthy
```

### 3b. Role-based access (RBAC)
After the operational schema exists, apply users/roles and demo identities once:
```bash
psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-schema.sql
psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-seed.sql
```
Seeded users share the local demo password from `LEAP_DEMO_PASSWORD` in your `.env`
(see `.env.example`). That value must match the BCrypt hashes in `database/rbac-seed.sql`.

| Username | Role | Sign-in |
|----------|------|---------|
| `admin` | SUPER_ADMIN (exactly one) | http://localhost:4200/admin/login |
| `joanna` | TRADER (own account only) | http://localhost:4200/login |
| `priya` | BUSINESS_ANALYST | http://localhost:4200/login → Analytics |
| `david` | TRADING_OPERATIONS | http://localhost:4200/login → Operations |

### 4. Fetch Market Prices
```bash
docker compose run --rm price-fetcher
```
Pulls live prices from Yahoo Finance (yfinance) into `instrument.last_price`.
Runs in a container, so yfinance does not need to be installed on the host.
The API prices orders from this column, so **run this before placing orders** —
an instrument with no price yet is rejected rather than traded at a fake price.
Re-run it (or schedule it) to keep prices current.

The first run also loads a year of price history into `instrument_price`. Once
it has, give the sample accounts (2–6) a few months of orders at those real
prices:
```bash
docker compose run --rm price-fetcher python seed_orders.py
```
It does nothing if they already have orders. `--reset` wipes the orders and
holdings of accounts 1–6, puts their cash back to the starting amounts, and
seeds again. Account 1 is never seeded, because the integration tests trade on it.

### 5. Run ETL Pipeline
```bash
docker compose run --rm etl
```
This extracts from `leapfrogsdb`, transforms, and loads into `leap_analytics`.
Only `status = 'COMPLETE'` transactions are extracted, so rejected orders never
count toward analytics volume.

To keep the analytics dashboard current, the `etl-scheduler` service runs the
same ETL on start and then every 15 minutes. Unlike the two commands above it is
a normal service, so `docker compose up -d` starts it:
```bash
docker compose up -d etl-scheduler
docker compose logs -f etl-scheduler     # see each refresh
```
Change the interval with `ETL_INTERVAL_MINUTES` in `.env`. Each refresh replaces
the analytics tables in a single transaction, so the dashboard never sees them
empty and a failed run keeps the previous data. Without Docker:
`python etl/scheduler.py`.

`price-fetcher` and `etl` use the same image (`etl/Dockerfile`) and are under the `tools`
profile, so `docker compose up` does not start them. To run either on the host
instead, `pip install -r etl/requirements-etl.txt` and use
`python etl/price_fetcher.py` / `python etl/main.py` — on the host, `.env` must
set `DB_PORT=8100`, since that is the published port.

### 6. Run Trading Demo
```bash
# Compile and run Java
mvn compile
mvn exec:java -Dexec.mainClass="com.neueda.leap.Main"
```

**How orders behave.** A market order fills straight away while its market is
open. A limit order fills only at its limit price or better. An order that
cannot fill yet (market closed, or limit not reached) waits as `PENDING` and
holds back the cash or shares it needs. Every 15 seconds the API fills pending
orders that can now fill. A Day order that has not filled by its session close
becomes `EXPIRED`; a Good-'til-cancelled one (limit only) waits until it fills.
Cancel a pending order with `POST /api/accounts/{id}/orders/{orderId}/cancel`
or the Cancel button on the Orders page. Trading hours live in
`services/MarketHours.java`; set `market.hours.enforced=false` in
`application.properties` to let every market trade around the clock.

### 7. Generate Analytics
```bash
python visualizations/insights-viz.py
```
Shows trading volume, most active stocks, and client trends as matplotlib charts.

## 🔍 Troubleshooting

### Postgres won't start
```bash
docker-compose down -v    # Remove volume
docker-compose up -d      # Start fresh
```

### "column ... does not exist" after pulling
Postgres only runs the initialization files when its volume is first created.
The operational and copy-trading schemas are loaded automatically for a fresh
volume. Existing databases are not changed automatically.

Do not run `docker compose down -v` unless you intend to delete the database
volume and all of its data.

### ETL fails - "Connection refused"
- Check `.env` has correct DB_HOST, DB_PORT, POSTGRES_USER, POSTGRES_PASSWORD
- Verify Postgres container is running: `docker ps`
- Wait a bit longer for Postgres to be healthy

### Analytics DB tables don't exist
- Run the ETL script: `python etl/main.py`
- It automatically creates `leap_analytics` and tables on first run

### Charts won't display
- Make sure analytics DB is populated (run ETL first)
- Check `.env` credentials are correct
- Verify Postgres is running on the configured port

---

## 📝 Notes

- All `.env` files are gitignored (credentials stay local)
- Java service and analytics DB run independently—you can use either or both
- Logging goes to `etl/etl_pipeline.log` for debugging
- This is a capstone project—code is functional but not production-hardened



