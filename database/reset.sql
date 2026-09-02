-- reset.sql
-- Rebuild the mock database objects and reload seed data.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/reset.sql

\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS reporting CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
DROP SCHEMA IF EXISTS trading CASCADE;
DROP SCHEMA IF EXISTS market_data CASCADE;
DROP SCHEMA IF EXISTS identity CASCADE;

\i database/migrations/001_extensions_and_schemas.sql
\i database/migrations/002_identity.sql
\i database/migrations/003_market_data.sql
\i database/migrations/004_trading.sql
\i database/migrations/005_audit.sql
\i database/migrations/006_reporting.sql
\i database/migrations/007_security.sql
\i database/migrations/008_trade_execution_function.sql

\i database/seeds/001_reference_data.sql
\i database/seeds/002_mock_clients.sql
\i database/seeds/003_mock_market_data.sql
\i database/seeds/004_mock_trading_activity.sql
