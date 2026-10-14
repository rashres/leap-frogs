-- Note: The following tables will be created in leap_analytics database
-- They must be created by running this script against the leap_analytics database:
-- psql -U postgres -d leap_analytics < capstone-analytics-schema.sql
--
-- Every statement is IF NOT EXISTS: the ETL runs this file on each refresh, so a
-- table added here reaches an existing analytics database without a rebuild.

CREATE TABLE IF NOT EXISTS fact_trades (
    transaction_id          INT PRIMARY KEY,
    account_id              INT             NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL ,
    segment                  VARCHAR(20)     NOT NULL ,
    stock_name              VARCHAR(150),
    exchange_name           VARCHAR(100),
    transaction_type        VARCHAR(4)      NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    quantity                NUMERIC(18,6)   NOT NULL,
    price                   NUMERIC(18,6)   NOT NULL,
    amount                  NUMERIC(18,2)   NOT NULL,
    trade_date              DATE            NOT NULL,
    transactions_time       TIMESTAMPTZ     NOT NULL,
    refreshed_at               TIMESTAMPTZ     NOT NULL DEFAULT now()  
);

CREATE INDEX IF NOT EXISTS idx_fact_trades_date ON fact_trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_fact_trades_symbol ON fact_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_fact_trades_segment ON fact_trades(segment);

CREATE TABLE IF NOT EXISTS trading_volume (
    symbol      VARCHAR(20) PRIMARY KEY,
    stock_name VARCHAR(150),
    buy_volume  NUMERIC(18,6) NOT NULL,
    sell_volume NUMERIC(18,6) NOT NULL,
    total_volume NUMERIC(18,6) NOT NULL,
    notional NUMERIC(18,2) NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now()  
);


CREATE TABLE IF NOT EXISTS instrument_activity (
    symbol      VARCHAR(20) PRIMARY KEY,
    stock_name VARCHAR(150),
    trades      INT NOT NULL,
    clients INT NOT NULL,
    buy_trades INT NOT NULL,
    sell_trades INT NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now()  

);

CREATE TABLE IF NOT EXISTS client_activity (
    month          DATE NOT NULL,
    segment        VARCHAR(20) NOT NULL,
    active_clients INT NOT NULL,
    trades      INT NOT NULL,
    volume      NUMERIC(18,6) NOT NULL,
    avg_trades_per_client   NUMERIC(10,2) NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
    PRIMARY KEY (month, segment)
);


-- Every order, whatever became of it: filled, still pending, cancelled by the
-- user, expired at its session close, or rejected. fact_trades holds only the
-- filled ones; this is where cancellations and expiries are counted.
CREATE TABLE IF NOT EXISTS fact_orders (
    transaction_id    INT PRIMARY KEY,
    account_id        INT            NOT NULL,
    symbol            VARCHAR(20)    NOT NULL,
    stock_name        VARCHAR(150),
    exchange_name     VARCHAR(100),
    transaction_type  VARCHAR(4)     NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    order_type        VARCHAR(6)     NOT NULL,
    time_in_force     VARCHAR(3)     NOT NULL,
    status            VARCHAR(10)    NOT NULL,
    quantity          NUMERIC(18,6)  NOT NULL,
    limit_price       NUMERIC(18,6),
    -- Fill price once COMPLETE; otherwise the market price when it was placed.
    price             NUMERIC(18,6)  NOT NULL,
    amount            NUMERIC(18,2)  NOT NULL,
    placed_at         TIMESTAMPTZ    NOT NULL,
    filled_at         TIMESTAMPTZ,
    -- When it was cancelled, expired, or rejected after waiting.
    closed_at         TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    placed_date       DATE           NOT NULL,
    refreshed_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fact_orders_status ON fact_orders(status);
CREATE INDEX IF NOT EXISTS idx_fact_orders_symbol ON fact_orders(symbol);
CREATE INDEX IF NOT EXISTS idx_fact_orders_date ON fact_orders(placed_date);

-- How each instrument's orders ended up. cancel_rate is cancelled / orders, as a percentage.
CREATE TABLE IF NOT EXISTS order_outcomes (
    symbol        VARCHAR(20) PRIMARY KEY,
    stock_name    VARCHAR(150),
    orders        INT          NOT NULL,
    filled        INT          NOT NULL,
    pending       INT          NOT NULL,
    cancelled     INT          NOT NULL,
    expired       INT          NOT NULL,
    rejected      INT          NOT NULL,
    cancel_rate   NUMERIC(5,2) NOT NULL,
    refreshed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
