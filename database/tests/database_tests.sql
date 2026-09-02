-- database_tests.sql
-- Run after migrations and seeds with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/tests/database_tests.sql

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition BOOLEAN, p_message TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT COALESCE(p_condition, FALSE) THEN
        RAISE EXCEPTION 'Test failed: %', p_message;
    END IF;
    RAISE NOTICE 'ok - %', p_message;
END;
$$;

SELECT pg_temp.assert_true((SELECT count(*) FROM identity.clients) = 20, 'seed has 20 clients');
SELECT pg_temp.assert_true((SELECT count(*) FROM trading.orders) = 200, 'seed has 200 orders');
SELECT pg_temp.assert_true((SELECT count(*) FROM market_data.instruments) = 50, 'seed has 50 instruments');

DO $$
DECLARE
    v_order trading.orders%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM trading.orders LIMIT 1;
    BEGIN
        INSERT INTO trading.orders (
            account_id, client_id, instrument_id, side, quantity, status, idempotency_key
        )
        VALUES (
            v_order.account_id, v_order.client_id, v_order.instrument_id, v_order.side, 1, 'SUBMITTED', v_order.idempotency_key
        );
        RAISE EXCEPTION 'duplicate idempotency key was accepted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'ok - duplicate idempotency keys are rejected';
    END;
END;
$$;

DO $$
DECLARE
    v_order trading.orders%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM trading.orders LIMIT 1;
    BEGIN
        INSERT INTO trading.orders (
            account_id, client_id, instrument_id, side, quantity, status, idempotency_key
        )
        VALUES (
            v_order.account_id, v_order.client_id, v_order.instrument_id, v_order.side, -1, 'SUBMITTED', 'negative-quantity-test'
        );
        RAISE EXCEPTION 'negative quantity was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'ok - negative quantities are rejected';
    END;
END;
$$;

DO $$
DECLARE
    v_instrument_id UUID;
BEGIN
    SELECT instrument_id INTO v_instrument_id FROM market_data.instruments LIMIT 1;
    BEGIN
        INSERT INTO market_data.quotes (
            instrument_id, quote_source, bid_price, ask_price, quote_currency_code, quoted_at, expires_at
        )
        SELECT v_instrument_id, 'TEST', -1, 1, trading_currency_code, now(), now() + interval '1 hour'
        FROM market_data.instruments
        WHERE instrument_id = v_instrument_id;
        RAISE EXCEPTION 'invalid price was accepted';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'ok - invalid prices are rejected';
    END;
END;
$$;

SELECT c.client_id::text AS client1_id
FROM identity.clients c
ORDER BY c.client_reference
LIMIT 1
\gset

SELECT a.account_id::text AS other_account_id
FROM trading.accounts a
JOIN identity.clients c ON c.client_id = a.client_id
WHERE c.client_id::text <> :'client1_id'
ORDER BY a.account_number
LIMIT 1
\gset

BEGIN;
SET LOCAL ROLE leap_app_role;
SELECT set_config('app.current_client_id', :'client1_id', true);
SELECT pg_temp.assert_true(
    (SELECT count(*) FROM trading.accounts WHERE account_id = :'other_account_id'::uuid) = 0,
    'RLS hides another client account from the app role'
);
COMMIT;

DO $$
DECLARE
    v_account RECORD;
    v_market RECORD;
    v_order_id UUID;
BEGIN
    SELECT account_id, client_id INTO v_account FROM trading.accounts ORDER BY account_number LIMIT 1;
    SELECT i.instrument_id, q.quote_id, q.ask_price
      INTO v_market
      FROM market_data.instruments i
      JOIN market_data.quotes q ON q.instrument_id = i.instrument_id
     WHERE i.asset_class = 'US_EQUITY'
     LIMIT 1;

    INSERT INTO trading.orders (
        account_id, client_id, instrument_id, side, quantity, status, idempotency_key, requested_quote_id, accepted_at
    )
    VALUES (
        v_account.account_id, v_account.client_id, v_market.instrument_id, 'BUY', 1, 'ACCEPTED',
        'overfill-test', v_market.quote_id, now()
    )
    RETURNING order_id INTO v_order_id;

    BEGIN
        PERFORM trading.process_fill(v_order_id, 2, v_market.ask_price, 0, 'OVERFILL-TEST', v_market.quote_id);
        RAISE EXCEPTION 'overfill was accepted';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE 'ok - an order cannot be filled beyond requested quantity';
    END;
END;
$$;

DO $$
DECLARE
    v_fill trading.fills%ROWTYPE;
BEGIN
    SELECT f.* INTO v_fill
    FROM trading.fills f
    JOIN trading.orders o ON o.order_id = f.order_id
    WHERE o.status = 'PARTIALLY_FILLED'
    LIMIT 1;

    BEGIN
        INSERT INTO trading.fills (
            order_id, account_id, instrument_id, quote_id, execution_reference,
            fill_quantity, execution_price, fee_amount, fee_currency_code, settlement_date
        )
        VALUES (
            v_fill.order_id, v_fill.account_id, v_fill.instrument_id, v_fill.quote_id, v_fill.execution_reference,
            v_fill.fill_quantity, v_fill.execution_price, v_fill.fee_amount, v_fill.fee_currency_code, v_fill.settlement_date
        );
        RAISE EXCEPTION 'duplicate fill was accepted';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'ok - duplicate fills are rejected';
    END;
END;
$$;

DO $$
DECLARE
    v_account RECORD;
    v_market RECORD;
    v_order_id UUID;
    v_fills_before INTEGER;
    v_trades_before INTEGER;
    v_ledger_before INTEGER;
BEGIN
    SELECT account_id, client_id INTO v_account FROM trading.accounts ORDER BY account_number LIMIT 1;
    SELECT i.instrument_id, q.quote_id, q.ask_price
      INTO v_market
      FROM market_data.instruments i
      JOIN market_data.quotes q ON q.instrument_id = i.instrument_id
     WHERE i.asset_class = 'US_EQUITY'
     LIMIT 1;

    INSERT INTO trading.orders (
        account_id, client_id, instrument_id, side, quantity, status, idempotency_key, requested_quote_id, accepted_at
    )
    VALUES (
        v_account.account_id, v_account.client_id, v_market.instrument_id, 'BUY', 999999999, 'ACCEPTED',
        'failed-fill-rollback-test', v_market.quote_id, now()
    )
    RETURNING order_id INTO v_order_id;

    SELECT count(*) INTO v_fills_before FROM trading.fills WHERE order_id = v_order_id;
    SELECT count(*) INTO v_trades_before FROM trading.trades WHERE order_id = v_order_id;
    SELECT count(*) INTO v_ledger_before FROM trading.cash_ledger_entries WHERE related_order_id = v_order_id;

    BEGIN
        PERFORM trading.process_fill(v_order_id, 999999999, v_market.ask_price, 0, 'ROLLBACK-TEST', v_market.quote_id);
        RAISE EXCEPTION 'insufficient cash fill was accepted';
    EXCEPTION WHEN raise_exception THEN
        SELECT pg_temp.assert_true((SELECT count(*) FROM trading.fills WHERE order_id = v_order_id) = v_fills_before, 'failed fill leaves no fill rows');
        SELECT pg_temp.assert_true((SELECT count(*) FROM trading.trades WHERE order_id = v_order_id) = v_trades_before, 'failed fill leaves no trade rows');
        SELECT pg_temp.assert_true((SELECT count(*) FROM trading.cash_ledger_entries WHERE related_order_id = v_order_id) = v_ledger_before, 'failed fill leaves no ledger rows');
    END;
END;
$$;

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1
        FROM trading.account_cash_balances b
        LEFT JOIN (
            SELECT account_id, currency_code, sum(amount) AS ledger_total
            FROM trading.cash_ledger_entries
            GROUP BY account_id, currency_code
        ) l ON l.account_id = b.account_id AND l.currency_code = b.currency_code
        WHERE round(b.available_balance + b.reserved_balance, 10) <> round(COALESCE(l.ledger_total, 0), 10)
    ),
    'cash balances reconcile with ledger entries'
);

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1
        FROM trading.positions p
        LEFT JOIN (
            SELECT account_id, instrument_id, sum(quantity_delta) AS movement_total
            FROM trading.position_movements
            GROUP BY account_id, instrument_id
        ) m ON m.account_id = p.account_id AND m.instrument_id = p.instrument_id
        WHERE round(p.position_quantity, 10) <> round(COALESCE(m.movement_total, 0), 10)
    ),
    'positions reconcile with position movements'
);

DO $$
DECLARE
    v_event_id BIGINT;
BEGIN
    SELECT audit_event_id INTO v_event_id FROM audit.audit_events LIMIT 1;
    BEGIN
        SET LOCAL ROLE leap_app_role;
        UPDATE audit.audit_events SET event_details = '{}'::jsonb WHERE audit_event_id = v_event_id;
        RAISE EXCEPTION 'app role updated immutable audit event';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
        RAISE NOTICE 'ok - immutable audit records cannot be changed by application role';
    END;
END;
$$;

SELECT pg_temp.assert_true(
    (SELECT count(*) FROM trading.fills f LEFT JOIN trading.orders o ON o.order_id = f.order_id WHERE o.order_id IS NULL) = 0,
    'seed fills satisfy order foreign keys'
);

SELECT pg_temp.assert_true(
    (SELECT count(*) FROM trading.trades t LEFT JOIN trading.fills f ON f.fill_id = t.fill_id WHERE f.fill_id IS NULL) = 0,
    'seed trades satisfy fill foreign keys'
);

SELECT 'All database tests completed successfully.' AS result;
