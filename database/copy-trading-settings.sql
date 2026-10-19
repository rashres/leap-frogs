-- Copy settings for a database created before they existed. Safe to run more than once.
-- New databases get these from copy-trading-schema.sql and do not need this file.
--
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/copy-trading-settings.sql

ALTER TABLE copy_subscription
    ADD COLUMN IF NOT EXISTS max_per_trade     NUMERIC(18,2) CHECK (max_per_trade > 0),
    ADD COLUMN IF NOT EXISTS stop_loss_percent NUMERIC(5,2) CHECK (stop_loss_percent > 0 AND stop_loss_percent <= 100),
    ADD COLUMN IF NOT EXISTS sell_on_stop_loss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS paused_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pause_reason      VARCHAR(10) CHECK (pause_reason IN ('USER', 'STOP_LOSS'));

-- A stop-loss sell has no leader order.
ALTER TABLE copy_trade ALTER COLUMN leader_transaction_id DROP NOT NULL;
