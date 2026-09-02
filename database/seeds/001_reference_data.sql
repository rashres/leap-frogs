-- 001_reference_data.sql
-- Repeatable reference data. Running the full seed set again starts from clean mock data.

BEGIN;

TRUNCATE TABLE
    audit.trading_events,
    audit.audit_events,
    trading.position_movements,
    trading.cash_ledger_entries,
    trading.trades,
    trading.fills,
    trading.order_validations,
    trading.order_status_history,
    trading.orders,
    trading.positions,
    trading.account_cash_balances,
    trading.accounts,
    market_data.quotes,
    market_data.crypto_details,
    market_data.fx_pair_details,
    market_data.equity_details,
    market_data.instruments,
    market_data.markets,
    market_data.currencies,
    identity.sessions,
    identity.user_roles,
    identity.roles,
    identity.clients,
    identity.users,
    identity.client_segments
RESTART IDENTITY CASCADE;

INSERT INTO market_data.currencies (currency_code, currency_name, currency_type, minor_unit) VALUES
('GBP', 'Pound sterling', 'FIAT', 2),
('USD', 'US dollar', 'FIAT', 2),
('INR', 'Indian rupee', 'FIAT', 2),
('EUR', 'Euro', 'FIAT', 2),
('BTC', 'Mock bitcoin unit', 'CRYPTO', 8),
('ETH', 'Mock ether unit', 'CRYPTO', 8),
('USDC', 'Mock USD crypto token', 'CRYPTO', 6);

INSERT INTO market_data.markets (market_code, market_name, country_code, timezone_name, status) VALUES
('LSE', 'Mock London Stock Exchange', 'GB', 'Europe/London', 'OPEN'),
('NASDAQ', 'Mock NASDAQ Market', 'US', 'America/New_York', 'OPEN'),
('NSE', 'Mock National Stock Exchange India', 'IN', 'Asia/Kolkata', 'OPEN'),
('FX24', 'Mock 24 Hour FX Venue', NULL, 'UTC', 'OPEN'),
('CRYPTO24', 'Mock 24 Hour Crypto Venue', NULL, 'UTC', 'OPEN');

INSERT INTO identity.client_segments (segment_code, segment_name, description) VALUES
('STARTER', 'Starter investors', 'New retail clients with low historical activity.'),
('ACTIVE', 'Active investors', 'Clients who place orders regularly.'),
('PREMIUM', 'Premium investors', 'Higher-balance retail clients.'),
('INTERNATIONAL', 'International investors', 'Clients who trade across multiple markets.');

INSERT INTO identity.roles (role_code, role_name, description) VALUES
('CLIENT', 'Client', 'Retail client access to own accounts.'),
('SUPPORT', 'Support analyst', 'Internal support access for dispute investigation.'),
('TRADING_OPS', 'Trading operations', 'Internal order and execution operations.'),
('AUDITOR', 'Auditor', 'Read-only audit review.');

COMMIT;
