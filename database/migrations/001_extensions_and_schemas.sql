-- 001_extensions_and_schemas.sql
-- Foundation for one PostgreSQL database with five logical schemas.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS market_data;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

COMMENT ON SCHEMA identity IS 'Users, clients, sessions, client segments, and access roles.';
COMMENT ON SCHEMA market_data IS 'Currencies, markets, instruments, asset-class details, and quotes.';
COMMENT ON SCHEMA trading IS 'Accounts, orders, fills, trades, cash, positions, and immutable trading ledgers.';
COMMENT ON SCHEMA audit IS 'Append-only audit records and trading lifecycle events.';
COMMENT ON SCHEMA reporting IS 'Reporting objects separated from live transactional tables.';

COMMIT;
