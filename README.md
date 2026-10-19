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
# Leap Frogs

A trading platform and analytics system built for the Leap Frogs capstone project.
The repository contains a Spring Boot trading API, an Angular trading interface,
a NestJS authentication stub, a PostgreSQL data layer, an ETL pipeline, and
analytics visualizations.

## Project Components

| Component | Location | Purpose |
| --- | --- | --- |
| Trading API | `src/main/java` | Spring Boot 3.2 REST API for accounts, holdings, instruments, prices, and orders |
| Trading UI | `ui/` | Angular 21 portfolio, markets, instrument, orders, and news pages |
| Auth service | `shared/auth-stub/` | NestJS development service for registration, JWT login, refresh, logout, and roles |
| Operational database | `database/capstone-mvp-schema.sql` | PostgreSQL accounts, instruments, holdings, transactions, and price history |
| Analytics database | `database/capstone-analytics-schema.sql` | PostgreSQL reporting tables populated by the ETL pipeline |
| ETL and pricing | `etl/` | Loads analytics data and fetches USD prices/history from Yahoo Finance |
| Visualizations | `visualizations/` | Matplotlib charts and tests for analytics output |

Market prices are not simulated in Java. `etl/price_fetcher.py` writes current
prices to `instrument.last_price` and records history in `instrument_price`. The
API uses that database value when an order is created.

## Team

- Jesse Marasigan
- Rahul Shrestha
- Jocelyn Vazquez
- Kadija Bennington
- Rohin Raina

## Prerequisites

- Java 17 or later and Maven
- Node.js 20 or later and npm
- Python 3.10 or later
- Docker Desktop with Docker Compose

## Quick Start

### 1. Configure the environment

```bash
cp .env.example .env
```

Set `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` in `.env`. The default
host configuration is `localhost:8100`, which is the port published by Compose.
Never commit real credentials or secrets.

### 2. Start PostgreSQL

```bash
docker compose up -d
```

The single PostgreSQL container creates both `leapfrogsdb` and `leap_analytics`
on its first startup. The initialization scripts are mounted from `database/`.
The database is published at `localhost:8100` and has a health check.

### 3. Fetch prices and seed sample data

```bash
docker compose run --rm price-fetcher
docker compose run --rm price-fetcher python seed_orders.py
```

The price fetcher uses `yfinance`, converts supported non-USD quotes to USD,
updates `instrument.last_price`, and backfills price history when needed. Run it
before placing orders; an instrument without a current price cannot be traded.
The seed command adds historical sample orders for accounts 2-6 and does nothing
when those accounts already have orders. Use `--reset` to reset and reseed those
accounts. Account 1 is reserved for integration tests.

Both commands run from the ETL image and are Compose `tools` profile tasks, so
they are not started by `docker compose up`.

### 4. Start the Spring Boot API

```bash
mvn spring-boot:run
```

The API listens on `http://localhost:8081` with the `/api` context path.

- API information: `GET http://localhost:8081/api/`
- Health check: `GET http://localhost:8081/api/health`
- Swagger UI: `http://localhost:8081/api/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8081/api/v3/api-docs`

The API refreshes prices through its scheduled price updater every five seconds
by default. The interval and enablement can be changed with
`price.update.interval.ms` and `price.update.enabled` in
`src/main/resources/application.properties`.

### 5. Start the Angular UI

```bash
cd ui
npm install
npm start
```

Open `http://localhost:4200`. The Angular dev server proxies `/api` to the
Spring API at `http://localhost:8081`. To use another API host:

```bash
LEAP_API_URL=http://<host>:8081 npm start
```

The UI has these routes:

| Route | Purpose |
| --- | --- |
| `/portfolio` | Active account summary, holdings, orders, and value history |
| `/markets` | Instruments grouped by market and watchlist |
| `/instrument/:id` | Price history, news, and the order ticket |
| `/orders` | Filled and rejected orders |
| `/news` | Instrument news and sentiment |

The active account is selected in the UI and stored in local storage. The UI
calculates average cost and unrealized P/L from filled orders because those
values are not returned by the API.

### 6. Start the authentication stub

```bash
cd shared/auth-stub
npm install
$env:JWT_SECRET="replace-with-a-development-secret"  # PowerShell
$env:AUTH_STUB_TEST_PASSWORD="replace-with-a-test-password"  # optional
npm run build
npm start
```

The service listens on `http://localhost:3000`. It stores users in memory, so
accounts disappear when the process stops. `JWT_SECRET` is required. If
`AUTH_STUB_TEST_PASSWORD` is set, the development users `dave`, `auditor`, and
`analyst` are created with the `MISSION_OPERATOR`, `AUDIT`, and `ANALYST` roles.
Supported roles are `USER`, `MISSION_OPERATOR`, `AUDIT`, and `ANALYST`.
This stub runs independently; the current Spring API and UI account selection do
not yet enforce its JWT tokens.

Authentication endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Register an in-memory user |
| `POST` | `/auth/login` | Issue 15-minute access and 7-day refresh tokens |
| `POST` | `/auth/refresh` | Issue a new access token |
| `POST` | `/auth/logout` | Invalidate a refresh token |

### 7. Run ETL and visualizations

```bash
docker compose run --rm etl
python visualizations/insights-viz.py
```

The ETL extracts only `COMPLETE` transactions from `leapfrogsdb`, transforms
them, and loads `trading_volume`, `instrument_activity`, `client_activity`, and
`fact_trades` into `leap_analytics`. Run it after new completed orders. For
host execution, install `etl/requirements-etl.txt` and keep `DB_PORT=8100`.

## API Resources

All paths below are relative to `/api`:

- `GET /accounts`, `GET /accounts/{id}`, and `GET /accounts/{id}/value-history?range=1D|1W|1M|3M|1Y`
- `GET /accounts/{id}/holdings`
- `GET /accounts/{id}/orders`
- `POST /accounts/{id}/orders` with a `BUY` or `SELL` request
- `GET /instruments`, `GET /instruments/{id}`, and `GET /instruments/{id}/prices?range=1D|1W|1M|3M|1Y`
- `GET /health`

Completed orders return `201`. Orders rejected for insufficient cash or shares
return `422`, are saved with status `FAILED`, and do not change holdings or cash.
Invalid requests return `400`; missing accounts or instruments return `404`.

## Development Commands

```bash
# Java compile and tests
mvn test

# Package the API
mvn clean package

# Angular production build
cd ui
npm run build

# Authentication service tests
cd shared/auth-stub
npm test
```

Jenkins runs the Maven package, Docker image build, and Maven test stages, then
publishes the JUnit XML reports from `target/surefire-reports/`.

## Troubleshooting

### Reset PostgreSQL

```bash
docker compose down -v
docker compose up -d
```

The schema initialization scripts run only when the database volume is empty.

### API cannot connect to PostgreSQL

Confirm that the container is healthy and that `.env` uses `DB_PORT=8100` for a
host-run API. Containers use the internal PostgreSQL port `5432` instead.

### UI shows `Offline`, `DB down`, or `No prices`

Check that the API is running on port `8081`, PostgreSQL is healthy, and the
price fetcher has successfully populated `instrument.last_price`.

### News is unavailable

NewsAPI is optional. Put `LEAP_NEWSAPI_KEY=your-key` in `ui/.env.local` and
restart the UI. Without a key, the UI uses its Yahoo Finance fallback through
the development proxy. The key is attached server-side and is not sent to the
browser.

## Notes

- `.env` and `ui/.env.local` are gitignored and must remain local.
- The API, UI, auth stub, ETL, and visualizations run as separate processes.
- ETL logs are written to `etl/etl_pipeline.log`.
- This is a capstone project and is functional but not production-hardened.



