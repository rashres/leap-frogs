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
    -- Budget for this copy: copied buys stop once the copied positions held
    -- (at cost) plus pending copied buys reach it.
    allocation          NUMERIC(18,2) NOT NULL CHECK (allocation > 0),
    -- Most a single copied buy may cost; NULL for no cap.
    max_per_trade       NUMERIC(18,2) CHECK (max_per_trade > 0),
    -- Pause copying once this copy has lost this percent of its allocation; NULL for none.
    stop_loss_percent   NUMERIC(5,2) CHECK (stop_loss_percent > 0 AND stop_loss_percent <= 100),
    -- Also sell this copy's shares when the stop-loss pauses it.
    sell_on_stop_loss   BOOLEAN NOT NULL DEFAULT false,
    -- While paused, the trader's buys are not copied; their sells still are.
    paused_at           TIMESTAMPTZ,
    pause_reason        VARCHAR(10) CHECK (pause_reason IN ('USER', 'STOP_LOSS')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_copy_subscription_active
    ON copy_subscription(follower_account_id, copy_trader_id)
    WHERE stopped_at IS NULL;
CREATE INDEX idx_copy_subscription_trader
    ON copy_subscription(copy_trader_id);

-- Every follower order placed by a copy. A copy's shares are worked out from
-- its own filled orders here, so a copied sell never touches shares the
-- follower bought themselves or through another copy.
CREATE TABLE copy_trade (
    follower_transaction_id INT PRIMARY KEY REFERENCES transactions(transaction_id),
    -- NULL for a sell placed by the copy's stop-loss rather than copied from the trader.
    leader_transaction_id   INT REFERENCES transactions(transaction_id),
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
