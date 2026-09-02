-- 002_mock_clients.sql
-- Fictional clients only. Passwords are mock hashes, not real credentials.

BEGIN;

WITH generated_clients AS (
    SELECT
        n,
        format('client%02s@example.test', n) AS email,
        format('Mock Client %s', n) AS display_name,
        format('CLI%05s', n) AS client_reference,
        (ARRAY['STARTER', 'ACTIVE', 'PREMIUM', 'INTERNATIONAL'])[1 + ((n - 1) % 4)] AS segment_code,
        (ARRAY['GBP', 'USD', 'INR', 'EUR'])[1 + ((n - 1) % 4)] AS base_currency_code
    FROM generate_series(1, 20) AS n
),
inserted_users AS (
    INSERT INTO identity.users (email, password_hash, display_name, status)
    SELECT
        email,
        encode(digest(format('fictional-client-%s-hash-source', n), 'sha256'), 'hex'),
        display_name,
        'ACTIVE'
    FROM generated_clients
    RETURNING user_id, email
),
inserted_clients AS (
    INSERT INTO identity.clients (user_id, segment_id, client_reference, client_status)
    SELECT
        u.user_id,
        s.segment_id,
        gc.client_reference,
        'ACTIVE'
    FROM generated_clients gc
    JOIN inserted_users u ON u.email = gc.email
    JOIN identity.client_segments s ON s.segment_code = gc.segment_code
    RETURNING client_id, client_reference
),
client_roles AS (
    INSERT INTO identity.user_roles (user_id, role_id)
    SELECT u.user_id, r.role_id
    FROM inserted_users u
    CROSS JOIN identity.roles r
    WHERE r.role_code = 'CLIENT'
)
INSERT INTO trading.accounts (client_id, account_number, account_name, account_type, base_currency_code, status, opened_at)
SELECT
    c.client_id,
    format('ACC%05s', right(c.client_reference, 5)),
    format('%s Primary Trading Account', c.client_reference),
    'INDIVIDUAL',
    gc.base_currency_code,
    'ACTIVE',
    now() - ((gc.n || ' days')::interval)
FROM inserted_clients c
JOIN generated_clients gc ON gc.client_reference = c.client_reference;

INSERT INTO trading.account_cash_balances (account_id, currency_code, available_balance, reserved_balance)
SELECT
    a.account_id,
    c.currency_code,
    CASE c.currency_code
        WHEN a.base_currency_code THEN 25000 + (substring(a.account_number from 4)::integer * 137)
        WHEN 'USD' THEN 12000 + (substring(a.account_number from 4)::integer * 53)
        WHEN 'GBP' THEN 9000 + (substring(a.account_number from 4)::integer * 41)
        WHEN 'INR' THEN 900000 + (substring(a.account_number from 4)::integer * 1000)
        WHEN 'EUR' THEN 8000 + (substring(a.account_number from 4)::integer * 37)
        WHEN 'USDC' THEN 1500 + (substring(a.account_number from 4)::integer * 11)
        ELSE 0
    END,
    0
FROM trading.accounts a
CROSS JOIN market_data.currencies c
WHERE c.currency_code IN ('GBP', 'USD', 'INR', 'EUR', 'USDC');

INSERT INTO trading.cash_ledger_entries (
    account_id, currency_code, amount, balance_after, entry_type, description, correlation_id
)
SELECT
    account_id,
    currency_code,
    available_balance,
    available_balance + reserved_balance,
    'DEPOSIT',
    'Opening fictional cash balance',
    'seed-opening-cash'
FROM trading.account_cash_balances
WHERE available_balance > 0;

INSERT INTO audit.audit_events (event_type, actor_system, client_id, account_id, event_details, correlation_id)
SELECT
    'ACCOUNT_OPENED',
    'seed_loader',
    a.client_id,
    a.account_id,
    jsonb_build_object('accountNumber', a.account_number, 'fictional', true),
    'seed-clients'
FROM trading.accounts a;

COMMIT;
