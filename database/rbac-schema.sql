-- Role-based access control for LEAP (idempotent).
-- Apply after capstone-mvp-schema.sql:
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-schema.sql

-- Account operational status (separate from login identity).
ALTER TABLE account
    ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'FROZEN'));

CREATE TABLE IF NOT EXISTS app_user (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(64)  NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    display_name   VARCHAR(100) NOT NULL,
    role           VARCHAR(32)  NOT NULL
        CHECK (role IN ('SUPER_ADMIN', 'TRADER', 'BUSINESS_ANALYST', 'TRADING_OPERATIONS')),
    account_id     INT REFERENCES account(account_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT app_user_username_unique UNIQUE (username),
    CONSTRAINT trader_requires_account CHECK (
        (role = 'TRADER' AND account_id IS NOT NULL)
        OR (role <> 'TRADER')
    )
);

-- Exactly one Super Admin in the database.
CREATE UNIQUE INDEX IF NOT EXISTS app_user_one_super_admin
    ON app_user ((role))
    WHERE role = 'SUPER_ADMIN';

CREATE INDEX IF NOT EXISTS idx_app_user_account ON app_user(account_id);
CREATE INDEX IF NOT EXISTS idx_account_status ON account(status);

CREATE TABLE IF NOT EXISTS account_status_event (
    event_id       SERIAL PRIMARY KEY,
    account_id     INT NOT NULL REFERENCES account(account_id),
    actor_user_id  INT NOT NULL REFERENCES app_user(user_id),
    action         VARCHAR(16) NOT NULL CHECK (action IN ('FREEZE', 'UNFREEZE')),
    reason         TEXT,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_status_event_account
    ON account_status_event(account_id, occurred_at DESC);

-- Block updates/deletes on freeze audit rows (append-only).
CREATE OR REPLACE FUNCTION account_status_event_immutable()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'account_status_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_status_event_no_update ON account_status_event;
CREATE TRIGGER account_status_event_no_update
    BEFORE UPDATE OR DELETE ON account_status_event
    FOR EACH ROW EXECUTE FUNCTION account_status_event_immutable();
