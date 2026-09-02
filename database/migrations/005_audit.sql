-- 005_audit.sql
-- Append-only audit records for dispute investigation and lifecycle reconstruction.

BEGIN;

CREATE TABLE audit.audit_events (
    audit_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES identity.users(user_id) ON DELETE SET NULL,
    actor_system TEXT,
    client_id UUID REFERENCES identity.clients(client_id) ON DELETE RESTRICT,
    account_id UUID REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    order_id UUID REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    fill_id UUID REFERENCES trading.fills(fill_id) ON DELETE RESTRICT,
    trade_id UUID REFERENCES trading.trades(trade_id) ON DELETE RESTRICT,
    quote_id UUID REFERENCES market_data.quotes(quote_id) ON DELETE RESTRICT,
    request_id TEXT,
    correlation_id TEXT,
    event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (actor_user_id IS NOT NULL OR actor_system IS NOT NULL),
    CHECK (event_details IS NOT NULL)
);

CREATE TABLE audit.trading_events (
    trading_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type TEXT NOT NULL,
    order_id UUID REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    fill_id UUID REFERENCES trading.fills(fill_id) ON DELETE RESTRICT,
    trade_id UUID REFERENCES trading.trades(trade_id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES identity.clients(client_id) ON DELETE RESTRICT,
    instrument_id UUID REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    previous_status TEXT,
    new_status TEXT,
    event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_id TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (event_details IS NOT NULL)
);

CREATE INDEX idx_audit_events_client_time ON audit.audit_events(client_id, created_at);
CREATE INDEX idx_audit_events_order_time ON audit.audit_events(order_id, created_at);
CREATE INDEX idx_audit_events_correlation ON audit.audit_events(correlation_id);
CREATE INDEX idx_audit_events_type_time ON audit.audit_events(event_type, created_at DESC);
CREATE INDEX idx_trading_events_order_time ON audit.trading_events(order_id, created_at);
CREATE INDEX idx_trading_events_client_time ON audit.trading_events(client_id, created_at);
CREATE INDEX idx_trading_events_instrument_time ON audit.trading_events(instrument_id, created_at DESC);

CREATE OR REPLACE FUNCTION audit.reject_immutable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit and ledger records are append-only and cannot be updated or deleted';
END;
$$;

CREATE TRIGGER trg_audit_events_append_only
BEFORE UPDATE OR DELETE ON audit.audit_events
FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();

CREATE TRIGGER trg_trading_events_append_only
BEFORE UPDATE OR DELETE ON audit.trading_events
FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();

CREATE TRIGGER trg_cash_ledger_append_only
BEFORE UPDATE OR DELETE ON trading.cash_ledger_entries
FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();

CREATE TRIGGER trg_position_movements_append_only
BEFORE UPDATE OR DELETE ON trading.position_movements
FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();

COMMENT ON TABLE audit.audit_events IS 'Append-only audit trail for security, access, pricing, order, fill, and trade decisions.';
COMMENT ON TABLE audit.trading_events IS 'Trading-specific lifecycle events for reconstructing an order from request through fill.';

COMMIT;
