-- 004_trading.sql
-- Transactional trading model: accounts, orders, fills, trades, cash, positions, and ledgers.

BEGIN;

CREATE TABLE trading.accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES identity.clients(client_id) ON DELETE RESTRICT,
    account_number TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    base_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (account_number = upper(account_number)),
    CHECK (account_type IN ('INDIVIDUAL', 'JOINT', 'ISA', 'SIPP', 'CORPORATE')),
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED'))
);

CREATE TABLE trading.account_cash_balances (
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    available_balance NUMERIC(28, 10) NOT NULL DEFAULT 0,
    reserved_balance NUMERIC(28, 10) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, currency_code),
    CHECK (available_balance >= 0),
    CHECK (reserved_balance >= 0)
);

CREATE TABLE trading.positions (
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    position_quantity NUMERIC(28, 10) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(28, 10) NOT NULL DEFAULT 0,
    average_cost NUMERIC(28, 10),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, instrument_id),
    CHECK (position_quantity >= 0),
    CHECK (reserved_quantity >= 0),
    CHECK (reserved_quantity <= position_quantity),
    CHECK (average_cost IS NULL OR average_cost >= 0)
);

CREATE TABLE trading.orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES identity.clients(client_id) ON DELETE RESTRICT,
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    side TEXT NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'MARKET',
    time_in_force TEXT NOT NULL DEFAULT 'DAY',
    quantity NUMERIC(28, 10) NOT NULL,
    filled_quantity NUMERIC(28, 10) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUBMITTED',
    idempotency_key TEXT NOT NULL,
    client_order_reference TEXT,
    requested_quote_id UUID REFERENCES market_data.quotes(quote_id) ON DELETE RESTRICT,
    execution_quote_id UUID REFERENCES market_data.quotes(quote_id) ON DELETE RESTRICT,
    limit_price NUMERIC(28, 10),
    stop_price NUMERIC(28, 10),
    reserved_cash_amount NUMERIC(28, 10) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(28, 10) NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    failure_reason TEXT,
    request_id TEXT,
    correlation_id TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (side IN ('BUY', 'SELL')),
    CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
    CHECK (time_in_force IN ('DAY', 'GTC', 'IOC', 'FOK')),
    CHECK (status IN ('SUBMITTED', 'ACCEPTED', 'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCELLED', 'FAILED')),
    CHECK (quantity > 0),
    CHECK (filled_quantity >= 0),
    CHECK (filled_quantity <= quantity),
    CHECK (limit_price IS NULL OR limit_price >= 0),
    CHECK (stop_price IS NULL OR stop_price >= 0),
    CHECK (reserved_cash_amount >= 0),
    CHECK (reserved_quantity >= 0),
    UNIQUE (account_id, idempotency_key),
    UNIQUE (account_id, client_order_reference)
);

CREATE TABLE trading.order_status_history (
    order_status_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    reason TEXT,
    changed_by_user_id UUID REFERENCES identity.users(user_id) ON DELETE SET NULL,
    changed_by_system TEXT,
    request_id TEXT,
    correlation_id TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (new_status IN ('SUBMITTED', 'ACCEPTED', 'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCELLED', 'FAILED')),
    CHECK (previous_status IS NULL OR previous_status IN ('SUBMITTED', 'ACCEPTED', 'PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'CANCELLED', 'FAILED')),
    CHECK (changed_by_user_id IS NOT NULL OR changed_by_system IS NOT NULL)
);

CREATE TABLE trading.order_validations (
    order_validation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    validation_type TEXT NOT NULL,
    validation_status TEXT NOT NULL,
    validation_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (validation_type IN ('SUFFICIENT_CASH', 'SUFFICIENT_HOLDINGS', 'INSTRUMENT_STATUS', 'INSTRUMENT_TRADABILITY', 'QUOTE_VALIDITY')),
    CHECK (validation_status IN ('PASSED', 'FAILED', 'WARNING'))
);

CREATE TABLE trading.fills (
    fill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    quote_id UUID REFERENCES market_data.quotes(quote_id) ON DELETE RESTRICT,
    execution_reference TEXT NOT NULL,
    fill_quantity NUMERIC(28, 10) NOT NULL,
    execution_price NUMERIC(28, 10) NOT NULL,
    fee_amount NUMERIC(28, 10) NOT NULL DEFAULT 0,
    fee_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    settlement_date DATE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (fill_quantity > 0),
    CHECK (execution_price > 0),
    CHECK (fee_amount >= 0),
    UNIQUE (order_id, execution_reference)
);

CREATE TABLE trading.trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fill_id UUID NOT NULL UNIQUE REFERENCES trading.fills(fill_id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    side TEXT NOT NULL,
    trade_quantity NUMERIC(28, 10) NOT NULL,
    trade_price NUMERIC(28, 10) NOT NULL,
    gross_trade_value NUMERIC(28, 10) NOT NULL,
    fee_amount NUMERIC(28, 10) NOT NULL DEFAULT 0,
    net_cash_amount NUMERIC(28, 10) NOT NULL,
    cash_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    traded_at TIMESTAMPTZ NOT NULL,
    settlement_date DATE,
    CHECK (side IN ('BUY', 'SELL')),
    CHECK (trade_quantity > 0),
    CHECK (trade_price > 0),
    CHECK (gross_trade_value >= 0),
    CHECK (fee_amount >= 0)
);

CREATE TABLE trading.cash_ledger_entries (
    cash_ledger_entry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    amount NUMERIC(28, 10) NOT NULL,
    balance_after NUMERIC(28, 10) NOT NULL,
    entry_type TEXT NOT NULL,
    related_order_id UUID REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    related_fill_id UUID REFERENCES trading.fills(fill_id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id TEXT,
    CHECK (amount <> 0),
    CHECK (balance_after >= 0),
    CHECK (entry_type IN ('DEPOSIT', 'WITHDRAWAL', 'BUY_TRADE', 'SELL_TRADE', 'FEE', 'RESERVE', 'RELEASE_RESERVE', 'ADJUSTMENT'))
);

CREATE TABLE trading.position_movements (
    position_movement_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES trading.accounts(account_id) ON DELETE RESTRICT,
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    quantity_delta NUMERIC(28, 10) NOT NULL,
    position_after NUMERIC(28, 10) NOT NULL,
    movement_type TEXT NOT NULL,
    related_order_id UUID REFERENCES trading.orders(order_id) ON DELETE RESTRICT,
    related_fill_id UUID REFERENCES trading.fills(fill_id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id TEXT,
    CHECK (quantity_delta <> 0),
    CHECK (position_after >= 0),
    CHECK (movement_type IN ('BUY_FILL', 'SELL_FILL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RESERVE', 'RELEASE_RESERVE'))
);

CREATE INDEX idx_accounts_client_id ON trading.accounts(client_id);
CREATE INDEX idx_cash_balances_currency ON trading.account_cash_balances(currency_code);
CREATE INDEX idx_positions_instrument ON trading.positions(instrument_id);
CREATE INDEX idx_orders_account_status_time ON trading.orders(account_id, status, submitted_at DESC);
CREATE INDEX idx_orders_client_time ON trading.orders(client_id, submitted_at DESC);
CREATE INDEX idx_orders_instrument_time ON trading.orders(instrument_id, submitted_at DESC);
CREATE INDEX idx_order_status_history_order_time ON trading.order_status_history(order_id, changed_at);
CREATE INDEX idx_order_validations_order ON trading.order_validations(order_id);
CREATE INDEX idx_fills_order_time ON trading.fills(order_id, executed_at);
CREATE INDEX idx_fills_instrument_time ON trading.fills(instrument_id, executed_at DESC);
CREATE INDEX idx_trades_time ON trading.trades(traded_at DESC);
CREATE INDEX idx_cash_ledger_account_time ON trading.cash_ledger_entries(account_id, created_at);
CREATE INDEX idx_position_movements_account_time ON trading.position_movements(account_id, created_at);

CREATE OR REPLACE FUNCTION trading.prevent_fill_over_execution()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    requested_quantity NUMERIC(28, 10);
    existing_filled_quantity NUMERIC(28, 10);
BEGIN
    SELECT quantity
      INTO requested_quantity
      FROM trading.orders
     WHERE order_id = NEW.order_id
     FOR UPDATE;

    IF requested_quantity IS NULL THEN
        RAISE EXCEPTION 'Order % does not exist', NEW.order_id;
    END IF;

    SELECT COALESCE(sum(fill_quantity), 0)
      INTO existing_filled_quantity
      FROM trading.fills
     WHERE order_id = NEW.order_id;

    IF existing_filled_quantity + NEW.fill_quantity > requested_quantity THEN
        RAISE EXCEPTION 'Fill would exceed requested order quantity';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_fill_over_execution
BEFORE INSERT ON trading.fills
FOR EACH ROW
EXECUTE FUNCTION trading.prevent_fill_over_execution();

COMMENT ON TABLE trading.orders IS 'A client instruction to buy or sell. It is saved before any execution begins.';
COMMENT ON TABLE trading.fills IS 'One execution against an order. An order can have many fills.';
COMMENT ON TABLE trading.trades IS 'Permanent business record created from a fill.';
COMMENT ON TABLE trading.account_cash_balances IS 'Mutable current cash by account and currency. Reconciled against the immutable cash ledger.';
COMMENT ON TABLE trading.cash_ledger_entries IS 'Append-only record of every cash movement.';
COMMENT ON TABLE trading.positions IS 'Mutable current holdings by account and instrument. Reconciled against position movements.';
COMMENT ON TABLE trading.position_movements IS 'Append-only record of every position quantity change.';

COMMIT;
