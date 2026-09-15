CREATE TABLE fact_trades (
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

CREATE INDEX idx_fact_trades_date ON fact_trades(trade_date);
CREATE INDEX idx_fact_trades_symbol ON fact_trades(symbol);
CREATE INDEX idx_fact_trades_segment ON fact_trades(segment);

CREATE TABLE trading_volume (
    symbol      VARCHAR(20) PRIMARY KEY,
    stock_name VARCHAR(150),
    buy_volume  NUMERIC(18,6) NOT NULL,
    sell_volume NUMERIC(18,6) NOT NULL,
    total_volume NUMERIC(18,6) NOT NULL,
    notional NUMERIC(18,2) NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now()  
);


CREATE TABLE instrument_activity (
    symbol      VARCHAR(20) PRIMARY KEY,
    stock_name VARCHAR(150),
    trades      INT NOT NULL,
    clients INT NOT NULL,
    buy_trades INT NOT NULL,
    sell_trades INT NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now()  

);

CREATE TABLE client_activity (
    month          DATE NOT NULL,
    segment        VARCHAR(20) NOT NULL,
    active_clients INT NOT NULL,
    trades      INT NOT NULL,
    volume      NUMERIC(18,6) NOT NULL,
    avg_trades_per_client   NUMERIC(10,2) NOT NULL,
    refreshed_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
    PRIMARY KEY (month, segment)
);

