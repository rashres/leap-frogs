-- 007_security.sql
-- Least-privilege roles, RLS examples, and immutable record protection.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leap_migration_role') THEN
        CREATE ROLE leap_migration_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leap_app_role') THEN
        CREATE ROLE leap_app_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leap_reporting_role') THEN
        CREATE ROLE leap_reporting_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leap_audit_readonly_role') THEN
        CREATE ROLE leap_audit_readonly_role NOLOGIN;
    END IF;
END
$$;

REVOKE ALL ON SCHEMA identity, market_data, trading, audit, reporting FROM PUBLIC;
GRANT USAGE ON SCHEMA identity, market_data, trading TO leap_app_role;
GRANT USAGE ON SCHEMA market_data, trading, reporting TO leap_reporting_role;
GRANT USAGE ON SCHEMA audit TO leap_audit_readonly_role;

GRANT SELECT ON market_data.currencies, market_data.markets, market_data.instruments,
    market_data.equity_details, market_data.fx_pair_details, market_data.crypto_details,
    market_data.quotes TO leap_app_role;

GRANT SELECT, INSERT ON identity.users, identity.clients, identity.sessions TO leap_app_role;
GRANT SELECT ON identity.client_segments, identity.roles, identity.user_roles TO leap_app_role;
GRANT UPDATE (last_login_at, updated_at, status) ON identity.users TO leap_app_role;
GRANT UPDATE (revoked_at, revoked_by) ON identity.sessions TO leap_app_role;

GRANT SELECT, INSERT, UPDATE ON trading.accounts, trading.account_cash_balances,
    trading.positions, trading.orders, trading.order_status_history,
    trading.order_validations TO leap_app_role;
GRANT SELECT ON trading.fills, trading.trades, trading.cash_ledger_entries,
    trading.position_movements TO leap_app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO leap_app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA trading TO leap_app_role;

GRANT SELECT ON ALL TABLES IN SCHEMA market_data TO leap_reporting_role;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO leap_reporting_role;
GRANT EXECUTE ON FUNCTION reporting.refresh_reporting_views() TO leap_reporting_role;
GRANT SELECT ON audit.audit_events, audit.trading_events TO leap_audit_readonly_role;

ALTER TABLE identity.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.account_cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.order_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.fills ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.cash_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.position_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_client_owns_client
ON identity.clients
FOR SELECT TO leap_app_role
USING (client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid);

CREATE POLICY app_client_owns_accounts
ON trading.accounts
FOR ALL TO leap_app_role
USING (client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid)
WITH CHECK (client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid);

CREATE POLICY app_client_owns_cash
ON trading.account_cash_balances
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = account_cash_balances.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_positions
ON trading.positions
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = positions.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_orders
ON trading.orders
FOR ALL TO leap_app_role
USING (client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid)
WITH CHECK (client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid);

CREATE POLICY app_client_owns_status_history
ON trading.order_status_history
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.orders o
        WHERE o.order_id = order_status_history.order_id
          AND o.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_validations
ON trading.order_validations
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.orders o
        WHERE o.order_id = order_validations.order_id
          AND o.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_fills
ON trading.fills
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = fills.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_trades
ON trading.trades
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = trades.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_cash_ledger
ON trading.cash_ledger_entries
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = cash_ledger_entries.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

CREATE POLICY app_client_owns_position_movements
ON trading.position_movements
FOR SELECT TO leap_app_role
USING (
    EXISTS (
        SELECT 1 FROM trading.accounts a
        WHERE a.account_id = position_movements.account_id
          AND a.client_id = NULLIF(current_setting('app.current_client_id', true), '')::uuid
    )
);

COMMENT ON POLICY app_client_owns_orders ON trading.orders IS
    'Application must SET app.current_client_id after authenticating the session; RLS then filters rows by owner.';

COMMIT;
