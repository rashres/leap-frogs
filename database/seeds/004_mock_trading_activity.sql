-- 004_mock_trading_activity.sql
-- Roughly 200 orders with mixed statuses plus fills, trades, ledgers, movements, and audit events.

BEGIN;

INSERT INTO trading.positions (account_id, instrument_id, position_quantity, reserved_quantity, average_cost)
SELECT
    a.account_id,
    i.instrument_id,
    CASE i.asset_class
        WHEN 'CRYPTO' THEN 5
        WHEN 'FX' THEN 10000
        ELSE 250
    END,
    0,
    q.mid_price
FROM trading.accounts a
CROSS JOIN market_data.instruments i
JOIN LATERAL (
    SELECT mid_price
    FROM market_data.quotes q
    WHERE q.instrument_id = i.instrument_id
    ORDER BY quoted_at DESC
    LIMIT 1
) q ON TRUE;

INSERT INTO trading.position_movements (
    account_id, instrument_id, quantity_delta, position_after, movement_type, description, correlation_id
)
SELECT
    account_id,
    instrument_id,
    position_quantity,
    position_quantity,
    'TRANSFER_IN',
    'Opening fictional position',
    'seed-opening-positions'
FROM trading.positions;

DO $$
DECLARE
    v_i INTEGER;
    v_account RECORD;
    v_market RECORD;
    v_order_id UUID;
    v_status TEXT;
    v_side TEXT;
    v_quantity NUMERIC(28, 10);
    v_fill_quantity NUMERIC(28, 10);
    v_fee NUMERIC(28, 10);
    v_submitted_at TIMESTAMPTZ;
BEGIN
    FOR v_i IN 1..200 LOOP
        SELECT a.account_id, a.client_id, a.account_number
          INTO v_account
          FROM trading.accounts a
         ORDER BY a.account_number
         OFFSET ((v_i - 1) % 20)
         LIMIT 1;

        SELECT i.instrument_id, i.instrument_code, i.asset_class, i.trading_currency_code,
               q.quote_id, q.bid_price, q.ask_price
          INTO v_market
          FROM market_data.instruments i
          JOIN LATERAL (
              SELECT quote_id, bid_price, ask_price
              FROM market_data.quotes q
              WHERE q.instrument_id = i.instrument_id
              ORDER BY q.quoted_at DESC
              LIMIT 1
          ) q ON TRUE
         ORDER BY i.instrument_code
         OFFSET ((v_i - 1) % 50)
         LIMIT 1;

        v_status := CASE
            WHEN v_i % 10 = 0 THEN 'REJECTED'
            WHEN v_i % 10 = 1 THEN 'CANCELLED'
            WHEN v_i % 10 = 2 THEN 'FAILED'
            WHEN v_i % 10 = 3 THEN 'ACCEPTED'
            WHEN v_i % 10 = 4 THEN 'PARTIALLY_FILLED'
            ELSE 'FILLED'
        END;
        v_side := CASE WHEN v_i % 3 = 0 THEN 'SELL' ELSE 'BUY' END;
        v_quantity := CASE
            WHEN v_market.asset_class = 'CRYPTO' THEN 0.01 + ((v_i % 5)::numeric / 100)
            WHEN v_market.asset_class = 'FX' THEN 100 + (v_i % 5) * 25
            ELSE 1 + (v_i % 8)
        END;
        v_fee := round((v_quantity * CASE WHEN v_side = 'BUY' THEN v_market.ask_price ELSE v_market.bid_price END) * 0.001, 10);
        v_submitted_at := now() - ((200 - v_i) || ' hours')::interval;

        INSERT INTO trading.orders (
            account_id, client_id, instrument_id, side, order_type, time_in_force,
            quantity, filled_quantity, status, idempotency_key, client_order_reference,
            requested_quote_id, request_id, correlation_id, submitted_at
        )
        VALUES (
            v_account.account_id, v_account.client_id, v_market.instrument_id, v_side, 'MARKET', 'DAY',
            v_quantity, 0, 'SUBMITTED', format('seed-idem-%s', v_i), format('SEED-ORDER-%s', v_i),
            v_market.quote_id, format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at
        )
        RETURNING order_id INTO v_order_id;

        INSERT INTO trading.order_status_history (
            order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id, changed_at
        )
        VALUES (
            v_order_id, NULL, 'SUBMITTED', 'Fictional client submitted order', 'seed_loader',
            format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at
        );

        IF v_status = 'REJECTED' THEN
            UPDATE trading.orders
               SET status = 'REJECTED',
                   rejection_reason = 'Mock validation failure',
                   updated_at = v_submitted_at + interval '1 minute'
             WHERE order_id = v_order_id;

            INSERT INTO trading.order_validations (order_id, validation_type, validation_status, validation_message, checked_at)
            VALUES (v_order_id, 'SUFFICIENT_CASH', 'FAILED', 'Mock rejected order for seed coverage', v_submitted_at + interval '30 seconds');

            INSERT INTO trading.order_status_history (order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id, changed_at)
            VALUES (v_order_id, 'SUBMITTED', 'REJECTED', 'Mock validation failure', 'seed_loader',
                    format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at + interval '1 minute');
        ELSE
            INSERT INTO trading.order_validations (order_id, validation_type, validation_status, validation_message, checked_at)
            VALUES
                (v_order_id, 'INSTRUMENT_STATUS', 'PASSED', 'Instrument active', v_submitted_at + interval '15 seconds'),
                (v_order_id, 'INSTRUMENT_TRADABILITY', 'PASSED', 'Instrument tradable', v_submitted_at + interval '16 seconds'),
                (v_order_id, CASE WHEN v_side = 'BUY' THEN 'SUFFICIENT_CASH' ELSE 'SUFFICIENT_HOLDINGS' END, 'PASSED', 'Mock balance check passed', v_submitted_at + interval '17 seconds'),
                (v_order_id, 'QUOTE_VALIDITY', 'PASSED', 'Quote accepted for mock execution', v_submitted_at + interval '18 seconds');

            UPDATE trading.orders
               SET status = 'ACCEPTED',
                   accepted_at = v_submitted_at + interval '1 minute',
                   updated_at = v_submitted_at + interval '1 minute'
             WHERE order_id = v_order_id;

            INSERT INTO trading.order_status_history (order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id, changed_at)
            VALUES (v_order_id, 'SUBMITTED', 'ACCEPTED', 'Mock validations passed', 'seed_loader',
                    format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at + interval '1 minute');

            INSERT INTO audit.audit_events (
                event_type, actor_system, client_id, account_id, order_id, quote_id, request_id, correlation_id, event_details, created_at
            )
            VALUES (
                'ORDER_ACCEPTED', 'seed_loader', v_account.client_id, v_account.account_id, v_order_id, v_market.quote_id,
                format('seed-request-%s', v_i), format('seed-correlation-%s', v_i),
                jsonb_build_object('side', v_side, 'quantity', v_quantity, 'instrumentCode', v_market.instrument_code),
                v_submitted_at + interval '1 minute'
            );

            IF v_status = 'CANCELLED' THEN
                UPDATE trading.orders SET status = 'CANCELLED', updated_at = v_submitted_at + interval '10 minutes'
                WHERE order_id = v_order_id;
                INSERT INTO trading.order_status_history (order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id, changed_at)
                VALUES (v_order_id, 'ACCEPTED', 'CANCELLED', 'Mock client cancellation', 'seed_loader',
                        format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at + interval '10 minutes');
            ELSIF v_status = 'FAILED' THEN
                UPDATE trading.orders SET status = 'FAILED', failure_reason = 'Mock execution venue failure', updated_at = v_submitted_at + interval '8 minutes'
                WHERE order_id = v_order_id;
                INSERT INTO trading.order_status_history (order_id, previous_status, new_status, reason, changed_by_system, request_id, correlation_id, changed_at)
                VALUES (v_order_id, 'ACCEPTED', 'FAILED', 'Mock execution venue failure', 'seed_loader',
                        format('seed-request-%s', v_i), format('seed-correlation-%s', v_i), v_submitted_at + interval '8 minutes');
            ELSIF v_status IN ('PARTIALLY_FILLED', 'FILLED') THEN
                v_fill_quantity := CASE WHEN v_status = 'PARTIALLY_FILLED' THEN v_quantity / 2 ELSE v_quantity END;

                IF v_status = 'FILLED' AND v_i % 7 = 0 THEN
                    PERFORM trading.process_fill(
                        v_order_id, v_quantity * 0.4,
                        CASE WHEN v_side = 'BUY' THEN v_market.ask_price ELSE v_market.bid_price END,
                        round(v_fee * 0.4, 10),
                        format('SEED-FILL-%s-A', v_i), v_market.quote_id, (v_submitted_at + interval '2 days')::date,
                        'seed_execution_engine', format('seed-request-%s', v_i), format('seed-correlation-%s', v_i),
                        v_submitted_at + interval '3 minutes'
                    );
                    PERFORM trading.process_fill(
                        v_order_id, v_quantity * 0.6,
                        CASE WHEN v_side = 'BUY' THEN v_market.ask_price ELSE v_market.bid_price END,
                        round(v_fee * 0.6, 10),
                        format('SEED-FILL-%s-B', v_i), v_market.quote_id, (v_submitted_at + interval '2 days')::date,
                        'seed_execution_engine', format('seed-request-%s', v_i), format('seed-correlation-%s', v_i),
                        v_submitted_at + interval '5 minutes'
                    );
                ELSE
                    PERFORM trading.process_fill(
                        v_order_id, v_fill_quantity,
                        CASE WHEN v_side = 'BUY' THEN v_market.ask_price ELSE v_market.bid_price END,
                        CASE WHEN v_status = 'PARTIALLY_FILLED' THEN round(v_fee / 2, 10) ELSE v_fee END,
                        format('SEED-FILL-%s', v_i), v_market.quote_id, (v_submitted_at + interval '2 days')::date,
                        'seed_execution_engine', format('seed-request-%s', v_i), format('seed-correlation-%s', v_i),
                        v_submitted_at + interval '4 minutes'
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$;

SELECT reporting.refresh_reporting_views();

COMMIT;
