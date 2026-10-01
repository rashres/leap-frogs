-- Simple MVP trading platform schema (Sprint 3 capstone design).
-- Single flat schema, 5 tables only: account, exchange, instrument, transactions, holdings.

CREATE TABLE account (
    account_id    SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    cash_balance   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exchange (
    exchange_id    SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    country        VARCHAR(100) NOT NULL
);

CREATE TABLE instrument (
    instrument_id       SERIAL PRIMARY KEY,
    symbol         VARCHAR(20) NOT NULL,
    name           VARCHAR(150) NOT NULL,
    exchange_id    INT NOT NULL REFERENCES exchange(exchange_id),
    UNIQUE (symbol, exchange_id)
);

CREATE TABLE transactions (
    transaction_id     SERIAL PRIMARY KEY,
    account_id            INT NOT NULL REFERENCES account(account_id),
    instrument_id           INT NOT NULL REFERENCES instrument(instrument_id),
    transaction_type   VARCHAR(4) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    quantity           NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
    price              NUMERIC(18,6) NOT NULL CHECK (price > 0),
    -- Outcome of the order. Mirrors Order.setStatus() in the Java domain:
    -- COMPLETE = executed successfully, FAILED = rejected by validation.
    status             VARCHAR(10) NOT NULL DEFAULT 'COMPLETE'
                       CHECK (status IN ('PENDING', 'COMPLETE', 'FAILED')),
    transaction_time   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE holdings (
    holding_id     SERIAL PRIMARY KEY,
    account_id        INT NOT NULL REFERENCES account(account_id),
    instrument_id       INT NOT NULL REFERENCES instrument(instrument_id),
    quantity       NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, instrument_id)
);

-- Indexes
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_instrument ON transactions(instrument_id);
CREATE INDEX idx_transactions_time ON transactions(transaction_time);
CREATE INDEX idx_instrument_exchange ON instrument(exchange_id);
CREATE INDEX idx_holdings_account ON holdings(account_id);

-- Sample data (Single Entry)
INSERT INTO exchange (name, country) VALUES ('NASDAQ', 'USA'), ('Binance', 'Global');

INSERT INTO instrument (symbol, name, exchange_id) VALUES
  ('AAPL', 'Apple Inc.', 1),
  ('BTC-USD', 'Bitcoin', 2);

INSERT INTO account (name, email, cash_balance) VALUES
  ('Jane Doe', 'jane@example.com', 10000.00);

INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price) VALUES
  (1, 1, 'BUY', 10, 150.00);

INSERT INTO holdings (account_id, instrument_id, quantity) VALUES
  (1, 1, 10);

-- ============================================================
-- Generate 50 transactions (5 accounts, 1 month) with inventory checks
-- ============================================================

-- 1) Add 5 new accounts
INSERT INTO account (name, email, cash_balance) VALUES
                                                    ('Alice Cooper', 'alice.cooper@example.com', 10000.00),
                                                    ('Bob Dylan', 'bob.dylan@example.com', 15000.00),
                                                    ('Carol White', 'carol.white@example.com', 12000.00),
                                                    ('David Green', 'david.green@example.com', 20000.00),
                                                    ('Emma Harris', 'emma.harris@example.com', 8000.00);

-- 2) Add a few more instruments for variety
INSERT INTO instrument (symbol, name, exchange_id) VALUES
                                                  ('MSFT', 'Microsoft Corporation', 1),
                                                  ('AMZN', 'Amazon.com, Inc.', 1),
                                                  ('TSLA', 'Tesla, Inc.', 1),
                                                  ('ETH-USD', 'Ethereum', 2)
    ON CONFLICT (symbol, exchange_id) DO NOTHING;

-- 3) Generate 50 transactions with inventory constraint
--    Step A: Create 35 BUY transactions to build inventory
--    Step B: Create 15 SELL transactions only from existing holdings
--    All spread over the last 1 month

WITH buy_txns AS (
    SELECT
        gs AS i,
        (SELECT MIN(account_id) FROM account WHERE email LIKE '%cooper%' OR email LIKE '%dylan%' OR email LIKE '%white%' OR email LIKE '%green%' OR email LIKE '%harris%') +
        (floor(random() * 5)::int) AS account_id,
        (ARRAY(SELECT instrument_id FROM instrument ORDER BY instrument_id))[
            1 + floor(random() * (SELECT COUNT(*) FROM instrument))::int
        ] AS instrument_id,
    round((1 + random() * 50)::numeric, 6) AS quantity,
    round((80 + random() * 420)::numeric, 6) AS price,
    (now() - interval '1 month') + (random() * interval '1 month') AS transaction_time
FROM generate_series(1, 35) gs
    )
INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, transaction_time)
SELECT
    account_id,
    instrument_id,
    'BUY',
    quantity,
    price,
    transaction_time
FROM buy_txns;

-- Step B: Create SELL transactions only from existing holdings
WITH existing_holdings AS (
    SELECT
        h.account_id,
        h.instrument_id,
        h.quantity,
        row_number() OVER (PARTITION BY h.account_id ORDER BY random()) AS rn
    FROM holdings h
),
     sell_candidates AS (
         SELECT
             account_id,
             instrument_id,
             quantity,
             rn
         FROM existing_holdings
         WHERE rn <= 3  -- Limit sells to avoid overselling
     ),
     sell_txns AS (
         SELECT
             sc.account_id,
             sc.instrument_id,
             GREATEST(round((0.01 + random() * (sc.quantity * 0.5))::numeric, 6), 0.01) AS quantity,
             round((80 + random() * 420)::numeric, 6) AS price,
             (now() - interval '1 month') + (random() * interval '1 month') AS transaction_time,
             row_number() OVER () AS rn
         FROM sell_candidates sc
     )
INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, transaction_time)
SELECT
    account_id,
    instrument_id,
    'SELL',
    quantity,
    price,
    transaction_time
FROM sell_txns
WHERE rn <= 15;  -- Limit to 15 SELL transactions

-- 3b) A couple of rejected orders, so the status column and the holdings
--     filter below are both exercised by the sample data.
INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, status) VALUES
  (1, 1, 'BUY',  5, 150.00, 'FAILED'),
  (1, 2, 'SELL', 1, 300.00, 'FAILED');

-- 4) Rebuild holdings from successful transactions (BUY adds, SELL subtracts).
--    Rejected (FAILED) and in-flight (PENDING) rows must not move holdings.
DELETE FROM holdings;

INSERT INTO holdings (account_id, instrument_id, quantity, updated_at)
SELECT
    t.account_id,
    t.instrument_id,
    round(
            SUM(
                    CASE
                        WHEN t.transaction_type = 'BUY' THEN t.quantity
                        ELSE -t.quantity
                        END
            )::numeric,
            6
    ) AS quantity,
    now()
FROM transactions t
WHERE t.status = 'COMPLETE'
GROUP BY t.account_id, t.instrument_id
HAVING round(
               SUM(
                       CASE
                           WHEN t.transaction_type = 'BUY' THEN t.quantity
                           ELSE -t.quantity
                           END
               )::numeric,
               6
       ) > 0;