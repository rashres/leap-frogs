CREATE TABLE dim_account (
    account_id      INT PRIMARY KEY,
    signup_date     DATE            NOT NULL,
    cash_balance    NUMERIC(18,2)   NOT NULL,
    segment         VARCHAR(20)     NOT NULL,
    loaded_at       TIMESTAMPTZ     NOT NULL
);

CREATE INDEX idx_dim_account_segment ON dim_account(segment);
CREATE INDEX idx_dim_account_signup ON dim_account(signup_date);


CREATE TABLE fact_trades (
    transaction_id          INT PRIMARY KEY,
    account_id              INT             NOT NULL,
    symbol                  VARCHAR(20)     NOT NULL ,
    stock_name              VARCHAR(150),
    exchange_name           VARCHAR(100),
    transaction_type        VARCHAR(4)      NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    quantity                NUMERIC(18,6)   NOT NULL,
    price                   NUMERIC(18,6)   NOT NULL,
    amount                  NUMERIC(18,2)   NOT NULL,
    trade_date              DATE            NOT NULL,
    transactions_time       TIMESTAMPTZ     NOT NULL,
    loaded_at               TIMESTAMPTZ     NOT NULL DEFAULT now()  
);

CREATE INDEX idx_fact_trades_date ON fact_trades(trade_date);
CREATE INDEX idx_fact_trades_symbol ON fact_trades(symbol);
CREATE INDEX idx_fact_trades_account ON fact_trades(account_id);

-- Q1 + Q2
-- volume for buy/sell and trades 
CREATE VIEW volume_by_symbol AS 
SELECT symbol,
        stock_name,
        exchange_name,
        SUM(quantity) AS volume,
        SUM(quantity) FILTER (WHERE transaction_type = 'BUY') as buy_volume,
        SUM(quantity) FILTER (WHERE transaction_type = 'SELL') as sell_volume,
        COUNT(*) AS trades,
        COUNT(DISTINCT account_id)          AS clients,
        SUM(amount)             AS notional
FROM fact_trades
GROUP BY symbol, stock_name, exchange_name
ORDER BY volume DESC;


-- Q1 + Q2
-- Over time trade and volume count per instrument day by day 
CREATE VIEW volume_daily AS
SELECT  trade_date,
        symbol,
        SUM(quantity) AS volume,
        COUNT(*) AS trades,
        SUM(amount) AS notional
FROM fact_trades 
GROUP BY trade_date, symbol
ORDER BY trade_date, symbol;

--Q1  
--buy vs sell split over time  
CREATE VIEW buy_sell_daily AS 
SELECT trade_date,
        transaction_type,
        SUM(quantity)   AS volume,
        COUNT(*)        AS trades,
        SUM(amount)     AS notional
FROM fact_trades
GROUP BY trade_date, transaction_type
ORDER BY trade_date, transaction_type;

--Q3 
-- overall activity per day and active clients and avg trades/clients
CREATE VIEW activity_daily AS
SELECT trade_date,
        COUNT(*)        AS trades,
        SUM(quantity)   AS volume,
        SUM(amount)     AS notional,
        COUNT(DISTINCT account_id)  AS active_clients,
        COUNT(DISTINCT symbol)      AS instruments_traded,
        ROUND(COUNT(*)::numeric / COUNT(DISTINCT account_id), 2 ) AS trades_per_client
FROM fact_trades
GROUP BY trade_date
ORDER BY trade_date;

--Q3
--trades per client and a  left join to also keepclients who havent traded 
CREATE VIEW client_trades AS 
SELECT a.account_id,
        a.segment,
        a.signup_date,
        a.cash_balance,
        COUNT(t.transaction_id)         AS trades,
        COALESCE(SUM(t.quantity),0)     AS volume,
        COALESCE(SUM(t.amount),0) AS notional,
        MIN(t.trade_date)           AS first_trade,
        MAX(t.trade_date)            AS last_trade
FROM dim_account a
LEFT JOIN fact_trades t ON t.account_id = a.account_id
Group BY a.account_id, a.segment, a.signup_date, a.cash_balance;

--Q3
-- Trades per client segment, avg trades per client, and client counts
CREATE VIEW segment_activity AS
SELECT a.segment,
        COUNT(DISTINCT a.account_id) AS clients,
        COUNT(DISTINCT t.account_id) AS active_clients,
        COUNT(t.transaction_id) AS trades,
        ROUND(COUNT(t.transaction_id)::numeric
        / NULLIF(COUNT(DISTINCT a.account_id),0),2) AS avg_trades_per_client,
        COALESCE(SUM(t.quantity),0) AS volume,
        COALESCE(SUM(t.amount),0)   AS notional
FROM dim_account a
LEFT JOIN fact_trades t on t.account_id = a.account_id
GROUP BY a.segment 
ORDER BY trades DESC;

--Q3
-- Segment activity over time (stacked charts )
CREATE VIEW segment_daily AS 
SELECT t.trade_date,
        a.segment,
        COUNT(DISTINCT t.account_id)    AS active_clients,
        COUNT(*)                        AS trades,
        SUM(t.quantity)                 AS volume,
        SUM(t.amount)                   AS notional
FROM fact_trades t 
JOIN dim_account a ON a.account_id = t.account_id
GROUP BY t.trade_date, a.segment
ORDER BY t.trade_date, a.segment;

--Q3
-- number of clients 
CREATE VIEW client_growth AS 
SELECT DATE_TRUNC('month', signup_date)::date AS signup_month,
        COUNT(*)                              AS new_clients,
        SUM(COUNT(*)) OVER (
            ORDER BY DATE_TRUNC('month', signup_date)
        )           AS cumulative_clients 
FROM dim_account
GROUP BY 1
ORDER BY 1;



