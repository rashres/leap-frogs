# Leap Frogs Mock PostgreSQL Database

This folder contains a complete PostgreSQL 16 mock database for a direct-to-consumer retail trading platform. All people, balances, positions, orders, and events are fictional.

## What Already Existed

Before this database was added, the repository was a small Java/Maven skeleton with a root app, a duplicate `starter/` app, a root `Dockerfile`, and a `Jenkinsfile`. There were no database files, SQL drafts, migrations, Docker Compose files, or environment templates. The database assets were added at the repository root in `database/` so they sit beside the main app and Docker setup without changing unrelated Java files.

## Five-Domain Structure

The database uses one PostgreSQL database named by `POSTGRES_DB`, with five schemas inside it:

| Schema | Purpose |
| --- | --- |
| `identity` | Login users, clients, sessions, client segments, and access roles. |
| `market_data` | Currencies, markets, instruments, asset-specific details, and quotes. |
| `trading` | Accounts, orders, fills, trades, cash balances, cash ledger entries, positions, and position movements. |
| `audit` | Append-only audit and trading lifecycle events. |
| `reporting` | Materialized reporting views separated from live transactional tables. |

One database was chosen instead of five independent databases because a fill must update the fill, trade, cash, position, order status, and audit records in a single ACID transaction. In simple terms, ACID means PostgreSQL treats the whole trade update as one all-or-nothing unit. If one step fails, all steps roll back.

Reporting is separate because analytics queries can be slower and wider than live trading queries. In this mock database, reporting uses materialized views. A materialized view is like a saved query result. It is quick to read, can be refreshed from transactional data, and could later be replaced by a read replica, analytics database, or warehouse table.

## Beginner Concepts

A primary key uniquely identifies one row in a table. Most business records use `UUID` primary keys so application code can safely reference them.

A foreign key links one table to another. For example, an order points to an account, client, and instrument. Foreign keys prevent orphan records.

Normalization means storing each fact in one sensible place. For example, common instrument facts live in `market_data.instruments`, while equity-only, FX-only, and crypto-only facts live in detail tables. This avoids one giant table full of unrelated empty columns.

An index helps PostgreSQL find rows quickly, similar to an index in a book. This database indexes common lookup paths such as account orders, quote history, order status history, and reporting dimensions.

A ledger entry is an immutable record of a cash movement. The current cash balance is useful for fast reads, but the ledger is the source used to prove how the balance got there.

## Key Trading Terms

An order is the client's instruction, such as "buy 5 units of this instrument." It is saved before execution begins.

A fill is an execution against an order. One order can have several fills if it is partially executed.

A trade is the permanent business record created from a fill. It stores side, quantity, price, value, fee, and settlement date.

A position is the current holding for one account and one instrument.

A cash balance is the current cash for one account and one currency.

A ledger entry is one immutable cash change, such as opening cash, a buy trade, a sell trade, or a fee.

## Table Responsibilities

| Table | Purpose and Ownership | Key Rules |
| --- | --- | --- |
| `identity.users` | Login identities owned by identity/access management. Columns include `user_id`, `email`, `password_hash`, `display_name`, `status`, and timestamps. | `user_id` primary key, unique email, password hashes only, status check, no plain-text passwords. |
| `identity.clients` | Financial client profile linked to a login user. | `client_id` primary key, one client per user for MVP, status check, no cascade delete from users. |
| `identity.roles` | Internal and client role definitions. | Unique uppercase `role_code`. |
| `identity.user_roles` | Many-to-many link between users and roles. | Composite primary key prevents duplicate role grants. |
| `identity.sessions` | Time-limited revocable sessions. | Stores token hashes only, `expires_at > created_at`, supports `revoked_at`. |
| `identity.client_segments` | Client grouping for reporting. | Unique uppercase segment code, soft deactivation through `is_active`. |
| `market_data.currencies` | Fiat and crypto currencies. | Primary key is `currency_code`, type check, minor units from 0 to 18. |
| `market_data.markets` | Trading venues such as mock LSE, NASDAQ, NSE, FX, and crypto venues. | Unique uppercase market code, status check. |
| `market_data.instruments` | Shared instrument facts across all asset classes. | UUID primary key, unique instrument code, asset class/status checks, tradability flag. |
| `market_data.equity_details` | Equity-only details such as exchange, country, lot size, and sector. | One row per equity instrument, lot size must be positive. |
| `market_data.fx_pair_details` | FX pair details. | Base and quote currency foreign keys, base and quote cannot match. |
| `market_data.crypto_details` | Crypto-only details such as network and decimal places. | One row per crypto instrument. |
| `market_data.quotes` | Indicative and execution quote records. | Bid/ask use `NUMERIC`, ask must be at least bid, quote expiry must be after quote time. |
| `trading.accounts` | Trading accounts owned by clients. | UUID primary key, unique account number, client FK, status check. |
| `trading.account_cash_balances` | Current cash by account and currency. | Composite primary key, non-negative available and reserved balances, version for optimistic locking if needed. |
| `trading.cash_ledger_entries` | Immutable cash movements. | Identity primary key, signed amount cannot be zero, append-only trigger, no cascade delete. |
| `trading.orders` | Client buy/sell instructions. | UUID primary key, quantity greater than zero, status/side checks, unique `(account_id, idempotency_key)`, filled quantity cannot exceed quantity. |
| `trading.order_status_history` | Every order status transition. | Append-style history with timestamp, reason, actor, request ID, and correlation ID. |
| `trading.order_validations` | Validation results for cash, holdings, instrument status, tradability, and quote validity. | Typed validation status and validation type checks. |
| `trading.fills` | Executions against orders. | UUID primary key, unique `(order_id, execution_reference)`, positive quantity and price, non-negative fee, trigger prevents overfill. |
| `trading.trades` | Permanent trade record created from each fill. | One trade per fill, no cascade delete, fixed-precision values. |
| `trading.positions` | Current holdings by account and instrument. | Composite primary key, non-negative quantity, reserved quantity cannot exceed position quantity. |
| `trading.position_movements` | Immutable position changes. | Identity primary key, signed quantity delta cannot be zero, append-only trigger. |
| `audit.audit_events` | General audit records for access, orders, pricing, and fills. | Append-only trigger, typed searchable columns plus JSONB details. |
| `audit.trading_events` | Trading lifecycle events for investigation. | Append-only trigger, links client/account/order/fill/trade/instrument where relevant. |
| `reporting.daily_trading_summary` | Materialized daily trade summary. | Refreshed from trades, grouped by day, instrument, market, segment, and side. |
| `reporting.instrument_activity_summary` | Materialized instrument activity summary. | Supports most-active instrument analysis. |
| `reporting.client_activity_summary` | Materialized client activity summary. | Supports activity trends by client and segment. |
| `reporting.order_status_summary` | Materialized order status summary. | Supports status analysis by day, instrument, side, and status. |

All timestamps use `TIMESTAMPTZ`. PostgreSQL stores these safely with time zone awareness; the application should send and display them consistently in UTC.

## Important Design Choices

Financial values use `NUMERIC(28, 10)` rather than floating-point types. Floating-point numbers can introduce tiny rounding errors, which is unacceptable for money, positions, fees, and prices.

The instrument model is split into one common table and three detail tables. UK, US, and Indian equities share `equity_details`; FX pairs use `fx_pair_details`; crypto assets use `crypto_details`.

Calculated values are stored only when they are part of a permanent record. For example, `trades.gross_trade_value` is stored because it captures the exact value used at execution time. Consistency is protected by the `trading.process_fill` function, which calculates and writes the related fill, trade, ledger, position, order, and audit records in one transaction.

Audit event details use `JSONB` for flexible context, but important search fields such as `client_id`, `account_id`, `order_id`, `fill_id`, `trade_id`, `quote_id`, `request_id`, and `correlation_id` are typed columns. Do not put passwords, tokens, or secrets into JSONB payloads.

## Security Model

The migration creates four PostgreSQL roles:

| Role | Intended Use |
| --- | --- |
| `leap_migration_role` | Schema ownership/migrations in a fuller deployment. |
| `leap_app_role` | Application access with limited reads/writes. |
| `leap_reporting_role` | Read reporting and market/trading data needed for reports. |
| `leap_audit_readonly_role` | Read audit records only. |

Normal application access should not update or delete audit records, cash ledger entries, or position movements. This is enforced in two ways: grants do not give the app role update/delete permissions, and append-only triggers reject updates/deletes on audit and ledger-style tables.

Row-Level Security is enabled on client-owned trading tables. The application must set the authenticated client context after validating the session:

```sql
SELECT set_config('app.current_client_id', '<authenticated-client-uuid>', true);
```

The policies then filter rows so the app role sees only that client's accounts, balances, positions, orders, fills, trades, and ledgers. In a real application, the server must set this value after authentication. The client/browser must never be trusted to supply it directly.

## Atomic Trade Processing

Use `trading.process_fill(...)` to process a fill. The function:

1. Locks the order row with `FOR UPDATE`.
2. Validates status, quantity, instrument status, quote validity, cash, and holdings.
3. Locks the cash balance and position rows.
4. Inserts the fill.
5. Inserts the trade.
6. Inserts the cash ledger entry.
7. Inserts the position movement.
8. Updates current cash balance.
9. Updates current position.
10. Updates the order's filled quantity and status.
11. Inserts audit and trading events.

If any step fails, PostgreSQL rolls back the entire function call. Row locks prevent simultaneous fills from overspending the same cash balance or overselling the same position.

## Duplicate Order Prevention

`trading.orders` has a unique constraint on `(account_id, idempotency_key)`. If the same client request is retried, the application can reuse the same idempotency key and avoid creating a duplicate order.

## Reconciliation

Cash reconciliation compares each current cash balance with the sum of its ledger entries. Position reconciliation compares each current position with the sum of its position movements. Example reconciliation queries are in `database/queries/example_queries.sql`.

## Start PostgreSQL

Create a local `.env` from the example and choose your own local password:

```bash
cp .env.example .env
docker compose up -d
```

The first container startup applies all migrations and seed files through `database/init/001_initialize.sql`.

## Apply Migrations and Seeds Manually

If PostgreSQL is already running:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/reset.sql
```

## Run Tests

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/database_tests.sql
```

The tests verify duplicate idempotency keys, negative quantities, invalid prices, RLS isolation, overfill prevention, duplicate fills, rollback behavior, reconciliation, immutable audit protection, and seed counts.

## Refresh Reporting

```sql
SELECT reporting.refresh_reporting_views();
```

Run this after loading new transactional data. Production systems often refresh reporting asynchronously so live trading is not slowed down.

## Reset the Database

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/reset.sql
```

If you want Docker to rebuild from scratch, remove the volume:

```bash
docker compose down -v
docker compose up -d
```

## MVP Assumptions

- Market orders are supported now; limit, stop, and stop-limit columns are present for future extension.
- Each client has one trading account initially; the schema supports multiple accounts later.
- Accounts can hold cash in multiple currencies.
- Orders can have multiple fills and therefore support partial fills.
- Cash and positions update immediately after a fill.
- Settlement date is optional for future formal settlement processing.
- Authentication data is stored in PostgreSQL for this mock implementation.
- Passwords and session tokens are stored as hashes only.
- Sessions expire and can be revoked.
- Real banking integrations, real money movement, full KYC, identity verification, advised trading, and discretionary trading are out of scope.
- All client, account, cash, order, position, and event data is fictional.
- Regulatory retention periods are not invented here; retention should be a configurable future decision.

## Future Improvements

- Add a real migration tool such as Flyway or Liquibase.
- Add application code that sets `app.current_client_id` safely after session validation.
- Add reserved-cash and reserved-position workflows at order acceptance time.
- Add formal settlement processing.
- Add more detailed reference data for market calendars and trading hours.
- Move reporting to a read replica or warehouse when data volume grows.
- Decide formal audit retention requirements with legal/compliance input.
