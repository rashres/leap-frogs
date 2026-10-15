-- Copy-trading schema. Demo rows may be loaded separately in a deployment environment.

CREATE TABLE copy_trader (
    copy_trader_id   SERIAL PRIMARY KEY,
    account_id       INT NOT NULL UNIQUE REFERENCES account(account_id),
    handle           VARCHAR(40) NOT NULL UNIQUE,
    strategy         VARCHAR(80) NOT NULL,
    markets          VARCHAR(100) NOT NULL,
    bio              TEXT NOT NULL,
    risk_level       VARCHAR(6) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    starting_capital NUMERIC(18,2) NOT NULL CHECK (starting_capital > 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE copy_subscription (
    subscription_id     SERIAL PRIMARY KEY,
    follower_account_id INT NOT NULL REFERENCES account(account_id),
    copy_trader_id      INT NOT NULL REFERENCES copy_trader(copy_trader_id),
    allocation          NUMERIC(18,2) NOT NULL CHECK (allocation > 0),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_copy_subscription_active
    ON copy_subscription(follower_account_id, copy_trader_id)
    WHERE stopped_at IS NULL;
CREATE INDEX idx_copy_subscription_trader
    ON copy_subscription(copy_trader_id);

CREATE TABLE copy_trade (
    follower_transaction_id INT PRIMARY KEY REFERENCES transactions(transaction_id),
    leader_transaction_id   INT NOT NULL REFERENCES transactions(transaction_id),
    subscription_id         INT NOT NULL REFERENCES copy_subscription(subscription_id)
);

CREATE INDEX idx_copy_trade_subscription
    ON copy_trade(subscription_id);

-- Demo lead traders use the sample accounts seeded by capstone-mvp-schema.sql.
-- Their performance is populated once etl/seed_orders.py creates sample trades.
INSERT INTO copy_trader (account_id, handle, strategy, markets, bio, risk_level, starting_capital)
VALUES
    (7, '@johnson_growth', 'US growth', 'US', 'Concentrated growth investing in established technology leaders.', 'MEDIUM', 50000.00),
    (8, '@smith_crypto', 'Digital assets', 'US,FX', 'Momentum-focused exposure to digital assets and liquid technology names.', 'HIGH', 75000.00),
    (9, '@martinez_global', 'Global value', 'UK,IN', 'Diversified value positions across international markets.', 'LOW', 100000.00),
    (10, '@chen_macro', 'Macro rotation', 'US,FX', 'A balanced approach that rotates between equities, crypto and currencies.', 'MEDIUM', 60000.00);
