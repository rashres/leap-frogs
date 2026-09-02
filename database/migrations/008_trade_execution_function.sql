-- 008_trade_execution_function.sql
-- Demonstrates atomic fill processing with row-level locks.

BEGIN;

CREATE OR REPLACE FUNCTION trading.process_fill(
    p_order_id UUID,
    p_fill_quantity NUMERIC(28, 10),
    p_execution_price NUMERIC(28, 10),
    p_fee_amount NUMERIC(28, 10),
    p_execution_reference TEXT,
    p_quote_id UUID DEFAULT NULL,
    p_settlement_date DATE DEFAULT NULL,
    p_actor_system TEXT DEFAULT 'mock_execution_engine',
    p_request_id TEXT DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL,
    p_executed_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = trading, market_data, identity, audit, public
AS $$
DECLARE
    v_order trading.orders%ROWTYPE;
    v_instrument market_data.instruments%ROWTYPE;
    v_quote market_data.quotes%ROWTYPE;
    v_fill_id UUID;
    v_trade_id UUID;
    v_cash_currency TEXT;
    v_gross_value NUMERIC(28, 10);
    v_net_cash_amount NUMERIC(28, 10);
    v_cash_before_available NUMERIC(28, 10);
    v_cash_before_reserved NUMERIC(28, 10);
    v_cash_after_available NUMERIC(28, 10);
    v_cash_after_reserved NUMERIC(28, 10);
    v_position_before NUMERIC(28, 10);
    v_position_reserved_before NUMERIC(28, 10);
    v_position_after NUMERIC(28, 10);
    v_position_reserved_after NUMERIC(28, 10);
    v_new_filled_quantity NUMERIC(28, 10);
    v_new_status TEXT;
    v_average_cost NUMERIC(28, 10);
    v_old_average_cost NUMERIC(28, 10);
BEGIN
    IF p_fill_quantity <= 0 THEN
        RAISE EXCEPTION 'Fill quantity must be greater than zero';
    END IF;
    IF p_execution_price <= 0 THEN
        RAISE EXCEPTION 'Execution price must be greater than zero';
    END IF;
    IF p_fee_amount < 0 THEN
        RAISE EXCEPTION 'Fee amount cannot be negative';
    END IF;

    SELECT *
      INTO v_order
      FROM trading.orders
     WHERE order_id = p_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;
    IF v_order.status NOT IN ('ACCEPTED', 'PARTIALLY_FILLED') THEN
        RAISE EXCEPTION 'Order % is not executable because status is %', p_order_id, v_order.status;
    END IF;
    IF v_order.filled_quantity + p_fill_quantity > v_order.quantity THEN
        RAISE EXCEPTION 'Fill would exceed requested order quantity';
    END IF;

    SELECT *
      INTO v_instrument
      FROM market_data.instruments
     WHERE instrument_id = v_order.instrument_id;

    IF NOT v_instrument.is_tradable OR v_instrument.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Instrument % is not currently tradable', v_instrument.instrument_code;
    END IF;

    v_cash_currency := v_instrument.trading_currency_code;
    v_gross_value := round(p_fill_quantity * p_execution_price, 10);
    v_net_cash_amount := CASE
        WHEN v_order.side = 'BUY' THEN -(v_gross_value + p_fee_amount)
        ELSE v_gross_value - p_fee_amount
    END;

    IF p_quote_id IS NOT NULL THEN
        SELECT *
          INTO v_quote
          FROM market_data.quotes
         WHERE quote_id = p_quote_id
           AND instrument_id = v_order.instrument_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Quote % does not belong to order instrument', p_quote_id;
        END IF;
        IF v_quote.expires_at < now() THEN
            RAISE EXCEPTION 'Quote % is stale and cannot be used for execution', p_quote_id;
        END IF;
    END IF;

    SELECT available_balance, reserved_balance
      INTO v_cash_before_available, v_cash_before_reserved
      FROM trading.account_cash_balances
     WHERE account_id = v_order.account_id
       AND currency_code = v_cash_currency
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No cash balance exists for account % currency %', v_order.account_id, v_cash_currency;
    END IF;

    INSERT INTO trading.positions (account_id, instrument_id, position_quantity, reserved_quantity)
    VALUES (v_order.account_id, v_order.instrument_id, 0, 0)
    ON CONFLICT (account_id, instrument_id) DO NOTHING;

    SELECT position_quantity, reserved_quantity, average_cost
      INTO v_position_before, v_position_reserved_before, v_old_average_cost
      FROM trading.positions
     WHERE account_id = v_order.account_id
       AND instrument_id = v_order.instrument_id
     FOR UPDATE;

    IF v_order.side = 'BUY' THEN
        IF v_cash_before_reserved >= (v_gross_value + p_fee_amount) THEN
            v_cash_after_available := v_cash_before_available;
            v_cash_after_reserved := v_cash_before_reserved - (v_gross_value + p_fee_amount);
        ELSIF v_cash_before_available >= ((v_gross_value + p_fee_amount) - v_cash_before_reserved) THEN
            v_cash_after_available := v_cash_before_available - ((v_gross_value + p_fee_amount) - v_cash_before_reserved);
            v_cash_after_reserved := 0;
        ELSE
            RAISE EXCEPTION 'Insufficient cash for order %', p_order_id;
        END IF;

        v_position_after := v_position_before + p_fill_quantity;
        v_position_reserved_after := v_position_reserved_before;
        v_average_cost := CASE
            WHEN v_position_after = 0 THEN NULL
            ELSE round(((COALESCE(v_old_average_cost, 0) * v_position_before) + v_gross_value) / v_position_after, 10)
        END;
    ELSE
        IF (v_position_before - v_position_reserved_before) + LEAST(v_position_reserved_before, p_fill_quantity) < p_fill_quantity THEN
            RAISE EXCEPTION 'Insufficient position for order %', p_order_id;
        END IF;

        v_cash_after_available := v_cash_before_available + v_gross_value - p_fee_amount;
        v_cash_after_reserved := v_cash_before_reserved;
        v_position_after := v_position_before - p_fill_quantity;
        v_position_reserved_after := GREATEST(v_position_reserved_before - p_fill_quantity, 0);
        v_average_cost := v_old_average_cost;
    END IF;

    v_new_filled_quantity := v_order.filled_quantity + p_fill_quantity;
    v_new_status := CASE
        WHEN v_new_filled_quantity = v_order.quantity THEN 'FILLED'
        ELSE 'PARTIALLY_FILLED'
    END;

    INSERT INTO trading.fills (
        order_id, account_id, instrument_id, quote_id, execution_reference,
        fill_quantity, execution_price, fee_amount, fee_currency_code,
        settlement_date, executed_at
    )
    VALUES (
        p_order_id, v_order.account_id, v_order.instrument_id, COALESCE(p_quote_id, v_order.execution_quote_id),
        p_execution_reference, p_fill_quantity, p_execution_price, p_fee_amount,
        v_cash_currency, p_settlement_date, p_executed_at
    )
    RETURNING fill_id INTO v_fill_id;

    INSERT INTO trading.trades (
        fill_id, order_id, account_id, instrument_id, side, trade_quantity, trade_price,
        gross_trade_value, fee_amount, net_cash_amount, cash_currency_code, traded_at, settlement_date
    )
    VALUES (
        v_fill_id, p_order_id, v_order.account_id, v_order.instrument_id, v_order.side,
        p_fill_quantity, p_execution_price, v_gross_value, p_fee_amount, v_net_cash_amount,
        v_cash_currency, p_executed_at, p_settlement_date
    )
    RETURNING trade_id INTO v_trade_id;

    INSERT INTO trading.cash_ledger_entries (
        account_id, currency_code, amount, balance_after, entry_type,
        related_order_id, related_fill_id, description, correlation_id
    )
    VALUES (
        v_order.account_id, v_cash_currency, v_net_cash_amount, v_cash_after_available + v_cash_after_reserved,
        CASE WHEN v_order.side = 'BUY' THEN 'BUY_TRADE' ELSE 'SELL_TRADE' END,
        p_order_id, v_fill_id, 'Cash movement for executed fill', p_correlation_id
    );

    INSERT INTO trading.position_movements (
        account_id, instrument_id, quantity_delta, position_after, movement_type,
        related_order_id, related_fill_id, description, correlation_id
    )
    VALUES (
        v_order.account_id, v_order.instrument_id,
        CASE WHEN v_order.side = 'BUY' THEN p_fill_quantity ELSE -p_fill_quantity END,
        v_position_after,
        CASE WHEN v_order.side = 'BUY' THEN 'BUY_FILL' ELSE 'SELL_FILL' END,
        p_order_id, v_fill_id, 'Position movement for executed fill', p_correlation_id
    );

    UPDATE trading.account_cash_balances
       SET available_balance = v_cash_after_available,
           reserved_balance = v_cash_after_reserved,
           updated_at = now(),
           version = version + 1
     WHERE account_id = v_order.account_id
       AND currency_code = v_cash_currency;

    UPDATE trading.positions
       SET position_quantity = v_position_after,
           reserved_quantity = v_position_reserved_after,
           average_cost = v_average_cost,
           updated_at = now(),
           version = version + 1
     WHERE account_id = v_order.account_id
       AND instrument_id = v_order.instrument_id;

    UPDATE trading.orders
       SET filled_quantity = v_new_filled_quantity,
           status = v_new_status,
           execution_quote_id = COALESCE(p_quote_id, execution_quote_id),
           reserved_cash_amount = CASE WHEN side = 'BUY' THEN GREATEST(reserved_cash_amount - (v_gross_value + p_fee_amount), 0) ELSE reserved_cash_amount END,
           reserved_quantity = CASE WHEN side = 'SELL' THEN GREATEST(reserved_quantity - p_fill_quantity, 0) ELSE reserved_quantity END,
           updated_at = now()
     WHERE order_id = p_order_id;

    INSERT INTO trading.order_status_history (
        order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id
    )
    VALUES (
        p_order_id, v_order.status, v_new_status, 'Fill processed atomically', p_actor_system, p_request_id, p_correlation_id
    );

    INSERT INTO audit.audit_events (
        event_type, actor_system, client_id, account_id, order_id, fill_id, trade_id, quote_id,
        request_id, correlation_id, event_details
    )
    VALUES (
        'FILL_PROCESSED', p_actor_system, v_order.client_id, v_order.account_id, p_order_id, v_fill_id,
        v_trade_id, COALESCE(p_quote_id, v_order.execution_quote_id), p_request_id, p_correlation_id,
        jsonb_build_object(
            'side', v_order.side,
            'fillQuantity', p_fill_quantity,
            'executionPrice', p_execution_price,
            'grossTradeValue', v_gross_value,
            'feeAmount', p_fee_amount
        )
    );

    INSERT INTO audit.trading_events (
        event_type, order_id, fill_id, trade_id, account_id, client_id, instrument_id,
        previous_status, new_status, event_details, request_id, correlation_id
    )
    VALUES (
        'FILL_PROCESSED', p_order_id, v_fill_id, v_trade_id, v_order.account_id, v_order.client_id,
        v_order.instrument_id, v_order.status, v_new_status,
        jsonb_build_object('cashCurrency', v_cash_currency, 'netCashAmount', v_net_cash_amount),
        p_request_id, p_correlation_id
    );

    RETURN v_fill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION trading.process_fill(
    UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO leap_app_role;

COMMENT ON FUNCTION trading.process_fill(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TIMESTAMPTZ)
IS 'Atomically inserts fill and trade records, writes ledgers, updates current balances/positions/orders, and audits the action.';

COMMIT;
