-- Cash a trader adds to their own account. Safe to run more than once.
-- New databases get this on first boot (docker-compose.yml); for an existing one:
--
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/cash-deposits.sql
--
-- Kept as rows (not only the new balance) so portfolio value history can undo
-- a deposit when it rewinds the account, the same way it undoes filled orders.

CREATE TABLE IF NOT EXISTS cash_deposit (
    deposit_id    SERIAL PRIMARY KEY,
    account_id    INT NOT NULL REFERENCES account(account_id),
    amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    deposited_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_deposit_account ON cash_deposit(account_id, deposited_at);
