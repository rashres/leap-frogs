-- Simple MVP trading platform schema (Sprint 3 capstone design).
-- Single flat schema: account, exchange, instrument, transactions, holdings,
-- plus instrument_price (price history for charts).

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
    -- Latest market price, refreshed by etl/price_fetcher.py (yfinance).
    -- NULL until the first fetch runs; orders are rejected while it is NULL.
    last_price         NUMERIC(18,6) CHECK (last_price > 0),
    price_updated_at   TIMESTAMPTZ,
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
    -- Copy of instrument.symbol, so the table reads on its own. Written with every upsert.
    symbol         VARCHAR(20) NOT NULL,
    quantity       NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, instrument_id)
);

-- One row per instrument per minute, in USD, written by etl/price_fetcher.py.
-- instrument.last_price stays the price orders fill at; this table only feeds
-- charts (GET /api/instruments/{id}/prices, GET /api/accounts/{id}/value-history).
CREATE TABLE instrument_price (
    instrument_id  INT           NOT NULL REFERENCES instrument(instrument_id),
    observed_at    TIMESTAMPTZ   NOT NULL,
    price          NUMERIC(18,6) NOT NULL CHECK (price > 0),
    PRIMARY KEY (instrument_id, observed_at)
);

-- Indexes
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_instrument ON transactions(instrument_id);
CREATE INDEX idx_transactions_time ON transactions(transaction_time);
CREATE INDEX idx_instrument_exchange ON instrument(exchange_id);
CREATE INDEX idx_holdings_account ON holdings(account_id);

-- ============================================================
-- Sample data
-- ============================================================

-- Symbols are Yahoo Finance tickers, so etl/price_fetcher.py can price them.
-- Every price is stored in USD; the fetcher converts GBp / INR quotes.
INSERT INTO exchange (name, country) VALUES
  ('NASDAQ', 'USA'),
  ('Binance', 'Global'),
  ('LSE', 'UK'),
  ('NSE', 'India'),
  ('FX', 'Global');

-- Tests refer to the first five by id (1 = AAPL ... 5 = TSLA); add new ones at the end.
INSERT INTO instrument (symbol, name, exchange_id) VALUES
  ('AAPL',        'Apple Inc.',                  1),
  ('BTC-USD',     'Bitcoin',                     2),
  ('MSFT',        'Microsoft Corporation',       1),
  ('AMZN',        'Amazon.com, Inc.',            1),
  ('TSLA',        'Tesla, Inc.',                 1),
  ('ETH-USD',     'Ethereum',                    2),
  ('SHEL.L',      'Shell plc',                   3),
  ('HSBA.L',      'HSBC Holdings plc',           3),
  ('VOD.L',       'Vodafone Group plc',          3),
  ('RELIANCE.NS', 'Reliance Industries Ltd',     4),
  ('TCS.NS',      'Tata Consultancy Services',   4),
  ('INFY.NS',     'Infosys Ltd',                 4),
  ('EURUSD=X',    'Euro / US Dollar',            5),
  ('GBPUSD=X',    'British Pound / US Dollar',   5);

-- Starting cash. etl/seed_orders.py uses the same amounts.
-- Account 1 is kept free of sample orders: the integration tests trade on it
-- and need its full $10,000.
INSERT INTO account (name, email, cash_balance) VALUES
  ('Jane Doe',     'jane@example.com',          10000.00),
  ('Alice Cooper', 'alice.cooper@example.com',  10000.00),
  ('Bob Dylan',    'bob.dylan@example.com',     15000.00),
  ('Carol White',  'carol.white@example.com',   12000.00),
  ('David Green',  'david.green@example.com',   20000.00),
  ('Emma Harris',  'emma.harris@example.com',    8000.00);

-- No sample orders here: prices do not exist until the price fetcher has run.
-- After its first run, `docker compose run --rm price-fetcher python seed_orders.py`
-- places sample orders for accounts 2-6 at real recorded prices.
