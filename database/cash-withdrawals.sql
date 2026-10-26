-- Cash a trader takes out of their own account. Safe to run more than once.
-- New databases get this on first boot (docker-compose.yml); for an existing one:
--
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/cash-withdrawals.sql
--
-- Kept as rows, like cash_deposit, so portfolio value history can undo a
-- withdrawal when it rewinds the account.

CREATE TABLE IF NOT EXISTS cash_withdrawal (
    withdrawal_id  SERIAL PRIMARY KEY,
    account_id     INT NOT NULL REFERENCES account(account_id),
    amount         NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    withdrawn_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_withdrawal_account ON cash_withdrawal(account_id, withdrawn_at);
