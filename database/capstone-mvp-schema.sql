-- Simple MVP trading platform schema (Sprint 3 capstone design).
-- Single flat schema, 5 tables only: customer, exchange, stock, transactions, holdings.

CREATE TABLE customer (
    customer_id    SERIAL PRIMARY KEY,
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

CREATE TABLE stock (
    stock_id       SERIAL PRIMARY KEY,
    symbol         VARCHAR(20) NOT NULL,
    name           VARCHAR(150) NOT NULL,
    exchange_id    INT NOT NULL REFERENCES exchange(exchange_id),
    UNIQUE (symbol, exchange_id)
);

CREATE TABLE transactions (
    transaction_id     SERIAL PRIMARY KEY,
    customer_id        INT NOT NULL REFERENCES customer(customer_id),
    stock_id           INT NOT NULL REFERENCES stock(stock_id),
    transaction_type   VARCHAR(4) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    quantity           NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
    price              NUMERIC(18,6) NOT NULL CHECK (price > 0),
    transaction_time   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE holdings (
    holding_id     SERIAL PRIMARY KEY,
    customer_id    INT NOT NULL REFERENCES customer(customer_id),
    stock_id       INT NOT NULL REFERENCES stock(stock_id),
    quantity       NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, stock_id)
);

-- Indexes
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_stock ON transactions(stock_id);
CREATE INDEX idx_transactions_time ON transactions(transaction_time);
CREATE INDEX idx_stock_exchange ON stock(exchange_id);
CREATE INDEX idx_holdings_customer ON holdings(customer_id);

-- Sample data
INSERT INTO exchange (name, country) VALUES ('NASDAQ', 'USA'), ('Binance', 'Global');

INSERT INTO stock (symbol, name, exchange_id) VALUES
  ('AAPL', 'Apple Inc.', 1),
  ('BTC-USD', 'Bitcoin', 2);

INSERT INTO customer (name, email, cash_balance) VALUES
  ('Jane Doe', 'jane@example.com', 10000.00);

INSERT INTO transactions (customer_id, stock_id, transaction_type, quantity, price) VALUES
  (1, 1, 'BUY', 10, 150.00);

INSERT INTO holdings (customer_id, stock_id, quantity) VALUES
  (1, 1, 10);
