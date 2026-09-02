# Database Setup Guide

This guide explains how to get the `MockDatabase` branch running on another laptop and how to start, test, reset, and inspect the PostgreSQL mock database.

## 1. What You Need Installed

Install these before starting:

- Git
- Docker Desktop
- PostgreSQL command-line client, which provides `psql`
- GitHub CLI, optional but useful for login and pushing

Check whether they are installed:

```bash
git --version
docker --version
docker compose version
psql --version
gh --version
```

If `docker` is missing, install Docker Desktop and open it once before running commands.

If `psql` is missing:

```bash
# macOS with Homebrew
brew install libpq
brew link --force libpq
```

or:

```bash
# macOS with full PostgreSQL package
brew install postgresql@16
```

## 2. Make Sure the Branch Is on GitHub

On the laptop where the work was created:

```bash
cd /Users/rahul/Desktop/project/leap-frogs
git status
git branch
```

You should be on:

```text
MockDatabase
```

If GitHub authentication is not set up:

```bash
gh auth login -h github.com -p https -w
gh auth setup-git
```

Then push the branch:

```bash
git push -u origin MockDatabase
```

If this fails with a permission error, sign in with the GitHub account that has write access to `rashres/leap-frogs`, or add the current GitHub account as a collaborator on the repository.

## 3. Clone the Repo on the Other Laptop

On the other laptop:

```bash
cd ~/Desktop
git clone https://github.com/rashres/leap-frogs.git
cd leap-frogs
git checkout MockDatabase
```

If you already cloned the repo before:

```bash
cd ~/Desktop/leap-frogs
git fetch origin
git checkout MockDatabase
git pull
```

Confirm you are on the right branch:

```bash
git status --short --branch
```

Expected:

```text
## MockDatabase...origin/MockDatabase
```

## 4. Create Your Local Environment File

The repo contains `.env.example`, but it should not contain real secrets.

Create your local `.env` file:

```bash
cp .env.example .env
```

Open `.env` and set a local development password:

```env
POSTGRES_DB=leap_frogs_mock
POSTGRES_USER=postgres
POSTGRES_PASSWORD=local_dev_password
DATABASE_URL=postgresql://postgres:local_dev_password@localhost:5432/leap_frogs_mock
```

Important:

- Do not commit `.env`.
- Use any local password you want.
- Make sure `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` match.

## 5. Start PostgreSQL

From the repo root:

```bash
docker compose up -d
```

This starts PostgreSQL 16 using `docker-compose.yml`.

The first time the database volume is created, Docker runs:

```text
database/init/001_initialize.sql
```

That init script applies:

- All migrations in `database/migrations/`
- All seed files in `database/seeds/`

So the database is created and populated automatically on first startup.

## 6. Check That the Container Is Running

Run:

```bash
docker compose ps
```

You should see the `postgres` service running and healthy.

You can also check logs:

```bash
docker compose logs postgres
```

Look for messages showing PostgreSQL is ready to accept connections.

## 7. Connect to the Database

Use the `DATABASE_URL` from `.env`:

```bash
source .env
psql "$DATABASE_URL"
```

Inside `psql`, list schemas:

```sql
\dn
```

You should see:

```text
identity
trading
market_data
audit
reporting
```

List tables:

```sql
\dt identity.*
\dt market_data.*
\dt trading.*
\dt audit.*
```

Exit `psql`:

```sql
\q
```

## 8. Confirm Seed Data Loaded

Run:

```bash
source .env
psql "$DATABASE_URL"
```

Then:

```sql
SELECT count(*) FROM identity.clients;
SELECT count(*) FROM trading.accounts;
SELECT count(*) FROM market_data.instruments;
SELECT count(*) FROM trading.orders;
```

Expected approximate results:

```text
20 clients
20 accounts
50 instruments
200 orders
```

## 9. Run Database Tests

From the repo root:

```bash
source .env
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/database_tests.sql
```

The tests check things like:

- Duplicate idempotency keys are rejected
- Negative quantities are rejected
- Invalid prices are rejected
- Row-Level Security blocks one client from seeing another client's account
- Orders cannot be overfilled
- Duplicate fills are rejected
- Failed fill processing rolls back partial changes
- Cash balances reconcile with the cash ledger
- Positions reconcile with position movements
- Application role cannot update immutable audit records

If tests pass, the final output should say:

```text
All database tests completed successfully.
```

## 10. Run Example Queries

The file `database/queries/example_queries.sql` contains examples for registration, sessions, order validation, idempotent order submission, order lifecycle lookup, reporting, and reconciliation.

Do not run the entire file blindly if you only want to inspect examples, because some examples insert or update data.

Open it and copy the query you want:

```bash
less database/queries/example_queries.sql
```

Then paste selected queries into `psql`.

## 11. Refresh Reporting Views

Reporting uses materialized views. A materialized view stores a query result and must be refreshed after new trading data is added.

Run:

```bash
source .env
psql "$DATABASE_URL" -c "SELECT reporting.refresh_reporting_views();"
```

Useful reporting queries:

```sql
SELECT * FROM reporting.daily_trading_summary LIMIT 10;
SELECT * FROM reporting.instrument_activity_summary ORDER BY fill_count DESC LIMIT 10;
SELECT * FROM reporting.client_activity_summary ORDER BY total_trade_value DESC LIMIT 10;
SELECT * FROM reporting.order_status_summary LIMIT 10;
```

## 12. Reset the Database

If you want to rebuild the schema and reload all seed data:

```bash
source .env
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/reset.sql
```

This drops and recreates the five schemas:

- `identity`
- `market_data`
- `trading`
- `audit`
- `reporting`

Then it reruns all migrations and seed files.

## 13. Fully Recreate the Docker Database

If you want to delete the Docker database volume and start completely fresh:

```bash
docker compose down -v
docker compose up -d
```

Warning: `docker compose down -v` deletes the local PostgreSQL data volume for this project.

## 14. Stop the Database

Stop the container but keep the data:

```bash
docker compose down
```

Start it again later:

```bash
docker compose up -d
```

## 15. Common Troubleshooting

If `docker` is not found:

```text
Install Docker Desktop and make sure it is running.
```

If port `5432` is already in use:

```bash
docker compose down
```

Then either stop the other PostgreSQL server or change the port in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"
```

If you use port `5433`, update `.env`:

```env
DATABASE_URL=postgresql://postgres:local_dev_password@localhost:5433/leap_frogs_mock
```

If authentication fails:

```bash
docker compose down -v
docker compose up -d
```

This is often needed if you changed `POSTGRES_PASSWORD` after the database volume was already created. PostgreSQL only applies the initial password when the volume is first created.

If migrations did not run:

```bash
docker compose logs postgres
```

Look for SQL errors. After fixing the SQL, recreate the volume:

```bash
docker compose down -v
docker compose up -d
```

If `psql` cannot connect:

```bash
source .env
echo "$DATABASE_URL"
docker compose ps
psql "$DATABASE_URL"
```

Make sure the password, database name, and port match.

## 16. Useful Docker Commands

View containers:

```bash
docker compose ps
```

View PostgreSQL logs:

```bash
docker compose logs postgres
```

Restart PostgreSQL:

```bash
docker compose restart postgres
```

Stop PostgreSQL:

```bash
docker compose down
```

Delete PostgreSQL data and start fresh:

```bash
docker compose down -v
docker compose up -d
```

## 17. Useful Database Commands

Connect:

```bash
source .env
psql "$DATABASE_URL"
```

List schemas:

```sql
\dn
```

List tables in a schema:

```sql
\dt trading.*
```

Describe a table:

```sql
\d trading.orders
```

Count rows:

```sql
SELECT count(*) FROM trading.orders;
```

Exit:

```sql
\q
```

## 18. Recommended First Verification Flow

Run these commands in order on a new laptop:

```bash
git clone https://github.com/rashres/leap-frogs.git
cd leap-frogs
git checkout MockDatabase
cp .env.example .env
```

Edit `.env`, then:

```bash
docker compose up -d
docker compose ps
source .env
psql "$DATABASE_URL" -c "SELECT count(*) FROM trading.orders;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/database_tests.sql
```

If those commands work, the mock database is running correctly.
