-- Demo identities for multi-role RBAC (idempotent).
-- password_hash values are BCrypt (cost 10) of the local LEAP_DEMO_PASSWORD
-- from .env — do not store that plaintext password in the repo.
-- Apply after rbac-schema.sql:
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/rbac-seed.sql

-- Joanna's trading account (stable email for upserts).
INSERT INTO account (name, email, cash_balance, status)
SELECT 'Joanna Trader', 'joanna@leap.demo', 25000.00, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM account WHERE email = 'joanna@leap.demo');

-- Demo users. Exactly one SUPER_ADMIN.
INSERT INTO app_user (username, password_hash, display_name, role, account_id)
SELECT 'admin',
       '$2b$10$bOKqmKREBX5OheJOjzf63O.3wkcQBybHLEaYvYP0UPf1XYLQjArH.',
       'Super Admin',
       'SUPER_ADMIN',
       NULL
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'admin');

INSERT INTO app_user (username, password_hash, display_name, role, account_id)
SELECT 'joanna',
       '$2b$10$bOKqmKREBX5OheJOjzf63O.3wkcQBybHLEaYvYP0UPf1XYLQjArH.',
       'Joanna',
       'TRADER',
       (SELECT account_id FROM account WHERE email = 'joanna@leap.demo')
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'joanna');

INSERT INTO app_user (username, password_hash, display_name, role, account_id)
SELECT 'priya',
       '$2b$10$bOKqmKREBX5OheJOjzf63O.3wkcQBybHLEaYvYP0UPf1XYLQjArH.',
       'Priya',
       'BUSINESS_ANALYST',
       NULL
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'priya');

INSERT INTO app_user (username, password_hash, display_name, role, account_id)
SELECT 'david',
       '$2b$10$bOKqmKREBX5OheJOjzf63O.3wkcQBybHLEaYvYP0UPf1XYLQjArH.',
       'David',
       'TRADING_OPERATIONS',
       NULL
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'david');
