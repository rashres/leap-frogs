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
