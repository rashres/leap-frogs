-- example_queries.sql
-- Commented examples for application, support, and reporting workflows.

-- 1. Registering a mock client.
-- Store only a password hash produced by the application, never the password itself.
WITH new_user AS (
    INSERT INTO identity.users (email, password_hash, display_name)
    VALUES ('new.client@example.test', encode(digest('example-registration-hash-source', 'sha256'), 'hex'), 'New Mock Client')
    RETURNING user_id
),
new_client AS (
    INSERT INTO identity.clients (user_id, segment_id, client_reference, client_status)
    SELECT user_id, segment_id, 'CLI99999', 'ACTIVE'
    FROM new_user
    CROSS JOIN identity.client_segments
    WHERE segment_code = 'STARTER'
    RETURNING client_id
)
INSERT INTO trading.accounts (client_id, account_number, account_name, base_currency_code)
SELECT client_id, 'ACC99999', 'CLI99999 Primary Trading Account', 'GBP'
FROM new_client;

-- 2. Creating a session.
INSERT INTO identity.sessions (user_id, session_token_hash, expires_at, ip_address, user_agent)
SELECT user_id, encode(digest('example-session-source', 'sha256'), 'hex'), now() + interval '30 minutes', '127.0.0.1', 'Mock Browser'
FROM identity.users
WHERE email = 'client01@example.test';

-- 3. Revoking a session.
UPDATE identity.sessions
SET revoked_at = now()
WHERE session_token_hash = encode(digest('example-session-source', 'sha256'), 'hex')
  AND revoked_at IS NULL;

-- 4. Finding an account's available cash.
SELECT account_id, currency_code, available_balance, reserved_balance
FROM trading.account_cash_balances
WHERE account_id = (
    SELECT account_id FROM trading.accounts ORDER BY account_number LIMIT 1
)
ORDER BY currency_code;

-- 5. Finding an account's current positions.
SELECT p.account_id, i.instrument_code, i.instrument_name, p.position_quantity, p.reserved_quantity
FROM trading.positions p
JOIN market_data.instruments i ON i.instrument_id = p.instrument_id
WHERE p.account_id = (
    SELECT account_id FROM trading.accounts ORDER BY account_number LIMIT 1
)
ORDER BY i.instrument_code;

-- 6. Displaying the order blotter.
SELECT o.submitted_at, a.account_number, i.instrument_code, o.side, o.order_type,
       o.quantity, o.filled_quantity, o.status
FROM trading.orders o
JOIN trading.accounts a ON a.account_id = o.account_id
JOIN market_data.instruments i ON i.instrument_id = o.instrument_id
ORDER BY o.submitted_at DESC
LIMIT 50;

-- 7. Displaying the complete lifecycle of one order.
WITH selected_order AS (
    SELECT order_id FROM trading.orders ORDER BY submitted_at DESC LIMIT 1
)
SELECT 'ORDER' AS record_type, o.submitted_at AS event_time, o.status, o.rejection_reason AS details
FROM trading.orders o
JOIN selected_order so ON so.order_id = o.order_id
UNION ALL
SELECT 'STATUS', h.changed_at, h.new_status, h.reason
FROM trading.order_status_history h
JOIN selected_order so ON so.order_id = h.order_id
UNION ALL
SELECT 'FILL', f.executed_at, NULL, format('qty=%s price=%s ref=%s', f.fill_quantity, f.execution_price, f.execution_reference)
FROM trading.fills f
JOIN selected_order so ON so.order_id = f.order_id
UNION ALL
SELECT 'AUDIT', ae.created_at, NULL, ae.event_type
FROM audit.audit_events ae
JOIN selected_order so ON so.order_id = ae.order_id
ORDER BY event_time;

-- 8. Validating a buy order.
WITH requested AS (
    SELECT a.account_id, i.instrument_id, q.quote_id, i.trading_currency_code, q.ask_price, 10::numeric AS quantity
    FROM trading.accounts a
    CROSS JOIN market_data.instruments i
    JOIN market_data.quotes q ON q.instrument_id = i.instrument_id
    WHERE i.instrument_code = 'USEQ001'
    ORDER BY a.account_number, q.quoted_at DESC
    LIMIT 1
)
SELECT available_balance >= (requested.quantity * requested.ask_price) AS has_sufficient_cash,
       i.status = 'ACTIVE' AND i.is_tradable AS instrument_is_tradable,
       q.expires_at > now() AS quote_is_valid
FROM requested
JOIN trading.account_cash_balances b ON b.account_id = requested.account_id
    AND b.currency_code = requested.trading_currency_code
JOIN market_data.instruments i ON i.instrument_id = requested.instrument_id
JOIN market_data.quotes q ON q.quote_id = requested.quote_id;

-- 9. Validating a sell order.
WITH requested AS (
    SELECT a.account_id, i.instrument_id, 5::numeric AS quantity
    FROM trading.accounts a
    CROSS JOIN market_data.instruments i
    WHERE i.instrument_code = 'UKEQ001'
    ORDER BY a.account_number
    LIMIT 1
)
SELECT (p.position_quantity - p.reserved_quantity) >= requested.quantity AS has_sufficient_holdings,
       i.status = 'ACTIVE' AND i.is_tradable AS instrument_is_tradable
FROM requested
JOIN trading.positions p ON p.account_id = requested.account_id
    AND p.instrument_id = requested.instrument_id
JOIN market_data.instruments i ON i.instrument_id = requested.instrument_id;

-- 10. Submitting an idempotent order.
-- The unique constraint on (account_id, idempotency_key) prevents duplicate requests.
INSERT INTO trading.orders (
    account_id, client_id, instrument_id, side, quantity, status, idempotency_key, requested_quote_id
)
SELECT a.account_id, a.client_id, i.instrument_id, 'BUY', 1, 'SUBMITTED', 'client-generated-idempotency-key-123', q.quote_id
FROM trading.accounts a
JOIN market_data.instruments i ON i.instrument_code = 'USEQ001'
JOIN market_data.quotes q ON q.instrument_id = i.instrument_id
ORDER BY a.account_number, q.quoted_at DESC
LIMIT 1
ON CONFLICT (account_id, idempotency_key) DO NOTHING
RETURNING order_id;

-- 11. Processing a fill atomically.
SELECT trading.process_fill(
    p_order_id := (SELECT order_id FROM trading.orders WHERE status = 'ACCEPTED' LIMIT 1),
    p_fill_quantity := 1,
    p_execution_price := 25,
    p_fee_amount := 0.05,
    p_execution_reference := 'example-fill-reference',
    p_quote_id := NULL,
    p_settlement_date := current_date + 2,
    p_actor_system := 'example_execution_engine',
    p_request_id := 'example-request',
    p_correlation_id := 'example-correlation'
);

-- 12. Finding the most active instruments.
SELECT instrument_code, instrument_name, asset_class, order_count, fill_count, total_trade_value
FROM reporting.instrument_activity_summary
ORDER BY fill_count DESC, total_trade_value DESC
LIMIT 10;

-- 13. Calculating trading volume by day.
SELECT trading_day, sum(trade_count) AS trade_count, sum(total_trade_value) AS trade_value
FROM reporting.daily_trading_summary
GROUP BY trading_day
ORDER BY trading_day;

-- 14. Calculating client activity by segment.
SELECT segment_code, count(*) AS clients, sum(order_count) AS orders, sum(total_trade_value) AS trade_value
FROM reporting.client_activity_summary
GROUP BY segment_code
ORDER BY trade_value DESC;

-- 15. Reconciling cash balances against the cash ledger.
SELECT b.account_id, b.currency_code, b.available_balance + b.reserved_balance AS current_total,
       COALESCE(sum(l.amount), 0) AS ledger_total
FROM trading.account_cash_balances b
LEFT JOIN trading.cash_ledger_entries l ON l.account_id = b.account_id
    AND l.currency_code = b.currency_code
GROUP BY b.account_id, b.currency_code, b.available_balance, b.reserved_balance
HAVING round(b.available_balance + b.reserved_balance, 10) <> round(COALESCE(sum(l.amount), 0), 10);

-- 16. Reconciling positions against position movements.
SELECT p.account_id, p.instrument_id, p.position_quantity AS current_quantity,
       COALESCE(sum(m.quantity_delta), 0) AS movement_total
FROM trading.positions p
LEFT JOIN trading.position_movements m ON m.account_id = p.account_id
    AND m.instrument_id = p.instrument_id
GROUP BY p.account_id, p.instrument_id, p.position_quantity
HAVING round(p.position_quantity, 10) <> round(COALESCE(sum(m.quantity_delta), 0), 10);

-- 17. Identifying duplicate or inconsistent records.
SELECT account_id, idempotency_key, count(*)
FROM trading.orders
GROUP BY account_id, idempotency_key
HAVING count(*) > 1;

SELECT order_id, quantity, filled_quantity
FROM trading.orders
WHERE filled_quantity > quantity;
