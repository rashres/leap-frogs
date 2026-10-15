-- Copy trading: tables plus demo data. Run once, by hand, against leapfrogsdb:
--
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/copy-trading.sql
--
-- Run it after etl/price_fetcher.py has priced every instrument: trade prices
-- are worked out from each instrument's current last_price, so the history
-- lines up with whatever the market is doing on the day you load it.
--
-- Adds six lead traders (five across the stock and FX markets, one crypto),
-- each with about five months of filled orders, and two customers who copy
-- two traders each. Every copied order is linked to the order it copied in
-- copy_trade. Cash and holdings are updated to match. The script stops with
-- an error, changing nothing, if it has already been run.

BEGIN;

-- ============================================================
-- Tables
-- ============================================================

-- A lead trader trades from an ordinary account; this row is their public profile.
CREATE TABLE IF NOT EXISTS copy_trader (
    copy_trader_id    SERIAL PRIMARY KEY,
    account_id        INT NOT NULL UNIQUE REFERENCES account(account_id),
    handle            VARCHAR(40) NOT NULL UNIQUE,
    strategy          VARCHAR(80) NOT NULL,
    -- Comma separated: US, UK, India, FX, Crypto.
    markets           VARCHAR(100) NOT NULL,
    bio               TEXT NOT NULL,
    risk_level        VARCHAR(6) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    -- What the trader started with; return is measured against it.
    starting_capital  NUMERIC(18,2) NOT NULL CHECK (starting_capital > 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An account copying a lead trader. Active while stopped_at is NULL.
CREATE TABLE IF NOT EXISTS copy_subscription (
    subscription_id      SERIAL PRIMARY KEY,
    follower_account_id  INT NOT NULL REFERENCES account(account_id),
    copy_trader_id       INT NOT NULL REFERENCES copy_trader(copy_trader_id),
    -- USD set aside; each copied buy is scaled by allocation / trader equity.
    allocation           NUMERIC(18,2) NOT NULL CHECK (allocation > 0),
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at           TIMESTAMPTZ
);

-- At most one active subscription per follower and trader.
CREATE UNIQUE INDEX IF NOT EXISTS uq_copy_subscription_active
    ON copy_subscription(follower_account_id, copy_trader_id) WHERE stopped_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_copy_subscription_trader ON copy_subscription(copy_trader_id);

-- Which follower order copied which lead trader order.
CREATE TABLE IF NOT EXISTS copy_trade (
    follower_transaction_id  INT PRIMARY KEY REFERENCES transactions(transaction_id),
    leader_transaction_id    INT NOT NULL REFERENCES transactions(transaction_id),
    subscription_id          INT NOT NULL REFERENCES copy_subscription(subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_copy_trade_subscription ON copy_trade(subscription_id);

-- ============================================================
-- Demo data
-- ============================================================

-- Whole shares for stocks, 4 decimals for crypto, lots of 100 units for FX.
CREATE OR REPLACE FUNCTION pg_temp.seed_qty(q NUMERIC, exchange_name TEXT) RETURNS NUMERIC AS $$
    SELECT CASE
        WHEN exchange_name = 'Binance' THEN trunc(q, 4)
        WHEN exchange_name = 'FX'      THEN trunc(q / 100) * 100
        WHEN q >= 1                    THEN trunc(q)
        ELSE trunc(q, 4)
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE TEMP TABLE seed_trader (
    name TEXT, email TEXT, handle TEXT, strategy TEXT, markets TEXT, bio TEXT,
    risk_level TEXT, starting_capital NUMERIC, days_active INT
) ON COMMIT DROP;

INSERT INTO seed_trader VALUES
  ('Marcus Hale', 'marcus.hale@example.com', '@hale_growth', 'US Tech Growth', 'US',
   'Concentrated in large-cap US tech. Buys quality names on pullbacks, trims into strength and lets winners run. Usually 4 to 6 positions.',
   'MEDIUM', 100000, 155),
  ('Eleanor Whitfield', 'eleanor.whitfield@example.com', '@whitfield_income', 'UK Dividend Income', 'UK',
   'FTSE income investor. Holds energy, banks and telecoms for their dividends and adds slowly over time. Low turnover, steady compounding.',
   'LOW', 80000, 158),
  ('Arjun Mehta', 'arjun.mehta@example.com', '@mehta_india', 'India Large-Cap', 'India',
   'Trades the biggest NSE names: Reliance and the IT majors. Leans on earnings seasons and rebalances every few weeks.',
   'MEDIUM', 60000, 146),
  ('Sofia Reyes', 'sofia.reyes@example.com', '@reyes_fx', 'FX Macro', 'FX',
   'Trades EUR/USD and GBP/USD around central bank meetings and inflation prints. Takes profits early and keeps positions small.',
   'MEDIUM', 50000, 140),
  ('Thomas Becker', 'thomas.becker@example.com', '@becker_global', 'Global Multi-Asset', 'US,UK,India,FX',
   'A balanced portfolio across US and UK equities, Indian IT and a euro hedge. Rebalances monthly and rarely trades in a hurry.',
   'LOW', 120000, 160),
  ('Kai Nakamura', 'kai.nakamura@example.com', '@kai_onchain', 'Crypto Momentum', 'Crypto',
   'Bitcoin and Ether only. Follows the trend, sizes up on breakouts and cuts quickly when momentum fades. Expect big swings.',
   'HIGH', 40000, 150);

-- Leader orders. BUY amount = USD to spend; SELL amount = share of the position
-- to sell (1 = all of it). price = the instrument's current price x factor.
-- Times are UTC, inside each market's trading hours.
CREATE TEMP TABLE seed_trade (
    email TEXT, symbol TEXT, days_ago INT, at TIME, side TEXT, amount NUMERIC, factor NUMERIC
) ON COMMIT DROP;

INSERT INTO seed_trade VALUES
  -- Marcus Hale: US tech
  ('marcus.hale@example.com', 'AAPL', 148, '15:05', 'BUY', 18000, 0.84),
  ('marcus.hale@example.com', 'MSFT', 146, '16:20', 'BUY', 20000, 0.86),
  ('marcus.hale@example.com', 'AMZN', 141, '14:50', 'BUY', 15000, 0.83),
  ('marcus.hale@example.com', 'TSLA', 133, '18:10', 'BUY', 9000, 0.92),
  ('marcus.hale@example.com', 'AAPL', 118, '15:40', 'BUY', 6000, 0.88),
  ('marcus.hale@example.com', 'TSLA', 104, '17:25', 'SELL', 1, 1.06),
  ('marcus.hale@example.com', 'TSLA', 97, '14:45', 'BUY', 8000, 1.08),
  ('marcus.hale@example.com', 'MSFT', 90, '19:15', 'BUY', 7000, 0.90),
  ('marcus.hale@example.com', 'AMZN', 82, '15:55', 'SELL', 0.4, 0.95),
  ('marcus.hale@example.com', 'AMZN', 74, '16:30', 'BUY', 6000, 0.91),
  ('marcus.hale@example.com', 'TSLA', 66, '18:40', 'SELL', 1, 0.93),
  ('marcus.hale@example.com', 'AAPL', 58, '14:55', 'BUY', 5000, 0.92),
  ('marcus.hale@example.com', 'MSFT', 49, '17:10', 'SELL', 0.3, 0.97),
  ('marcus.hale@example.com', 'TSLA', 41, '15:20', 'BUY', 7000, 0.89),
  ('marcus.hale@example.com', 'AAPL', 33, '16:05', 'SELL', 0.25, 0.96),
  ('marcus.hale@example.com', 'MSFT', 27, '18:30', 'BUY', 6500, 0.94),
  ('marcus.hale@example.com', 'TSLA', 19, '15:45', 'SELL', 0.5, 1.02),
  ('marcus.hale@example.com', 'AMZN', 12, '14:40', 'BUY', 5000, 0.97),
  ('marcus.hale@example.com', 'AAPL', 6, '17:50', 'BUY', 4000, 0.99),
  ('marcus.hale@example.com', 'AMZN', 2, '15:15', 'SELL', 0.2, 1.01),

  -- Eleanor Whitfield: UK dividends
  ('eleanor.whitfield@example.com', 'SHEL.L', 150, '09:15', 'BUY', 22000, 0.90),
  ('eleanor.whitfield@example.com', 'HSBA.L', 149, '10:40', 'BUY', 20000, 0.85),
  ('eleanor.whitfield@example.com', 'VOD.L', 145, '13:05', 'BUY', 12000, 0.95),
  ('eleanor.whitfield@example.com', 'SHEL.L', 120, '11:30', 'BUY', 6000, 0.93),
  ('eleanor.whitfield@example.com', 'VOD.L', 95, '09:50', 'SELL', 0.5, 0.91),
  ('eleanor.whitfield@example.com', 'HSBA.L', 88, '14:10', 'BUY', 6000, 0.88),
  ('eleanor.whitfield@example.com', 'SHEL.L', 71, '10:25', 'BUY', 4000, 0.96),
  ('eleanor.whitfield@example.com', 'HSBA.L', 63, '12:45', 'SELL', 0.25, 0.97),
  ('eleanor.whitfield@example.com', 'VOD.L', 52, '09:35', 'BUY', 5000, 0.97),
  ('eleanor.whitfield@example.com', 'SHEL.L', 38, '13:20', 'SELL', 0.2, 0.99),
  ('eleanor.whitfield@example.com', 'HSBA.L', 29, '10:05', 'BUY', 5000, 0.95),
  ('eleanor.whitfield@example.com', 'VOD.L', 16, '11:50', 'SELL', 0.3, 1.02),
  ('eleanor.whitfield@example.com', 'SHEL.L', 8, '09:40', 'BUY', 4500, 0.98),
  ('eleanor.whitfield@example.com', 'HSBA.L', 3, '14:30', 'SELL', 0.15, 1.01),

  -- Arjun Mehta: India large-cap
  ('arjun.mehta@example.com', 'RELIANCE.NS', 140, '04:30', 'BUY', 16000, 0.88),
  ('arjun.mehta@example.com', 'TCS.NS', 139, '05:45', 'BUY', 14000, 1.04),
  ('arjun.mehta@example.com', 'INFY.NS', 137, '07:20', 'BUY', 12000, 0.93),
  ('arjun.mehta@example.com', 'RELIANCE.NS', 112, '06:10', 'BUY', 5000, 0.90),
  ('arjun.mehta@example.com', 'TCS.NS', 96, '08:35', 'SELL', 0.5, 0.97),
  ('arjun.mehta@example.com', 'INFY.NS', 81, '05:05', 'BUY', 5000, 0.95),
  ('arjun.mehta@example.com', 'RELIANCE.NS', 69, '04:50', 'SELL', 0.3, 0.98),
  ('arjun.mehta@example.com', 'TCS.NS', 55, '06:40', 'BUY', 4000, 0.96),
  ('arjun.mehta@example.com', 'INFY.NS', 43, '07:55', 'SELL', 0.35, 1.03),
  ('arjun.mehta@example.com', 'RELIANCE.NS', 30, '05:25', 'BUY', 4500, 0.95),
  ('arjun.mehta@example.com', 'TCS.NS', 18, '08:15', 'SELL', 0.4, 0.99),
  ('arjun.mehta@example.com', 'INFY.NS', 9, '04:40', 'BUY', 4000, 0.98),
  ('arjun.mehta@example.com', 'RELIANCE.NS', 4, '06:55', 'SELL', 0.2, 1.01),

  -- Sofia Reyes: FX
  ('sofia.reyes@example.com', 'EURUSD=X', 135, '09:30', 'BUY', 20000, 0.955),
  ('sofia.reyes@example.com', 'GBPUSD=X', 134, '13:15', 'BUY', 15000, 0.97),
  ('sofia.reyes@example.com', 'EURUSD=X', 110, '15:40', 'SELL', 0.5, 0.985),
  ('sofia.reyes@example.com', 'GBPUSD=X', 102, '08:20', 'BUY', 8000, 0.965),
  ('sofia.reyes@example.com', 'GBPUSD=X', 86, '12:05', 'SELL', 0.4, 0.99),
  ('sofia.reyes@example.com', 'EURUSD=X', 77, '10:50', 'BUY', 10000, 0.975),
  ('sofia.reyes@example.com', 'EURUSD=X', 60, '14:25', 'SELL', 0.3, 0.965),
  ('sofia.reyes@example.com', 'GBPUSD=X', 47, '09:10', 'BUY', 6000, 0.98),
  ('sofia.reyes@example.com', 'GBPUSD=X', 34, '16:35', 'SELL', 0.35, 1.005),
  ('sofia.reyes@example.com', 'EURUSD=X', 21, '11:20', 'BUY', 8000, 0.985),
  ('sofia.reyes@example.com', 'EURUSD=X', 11, '13:45', 'SELL', 0.25, 1.0),
  ('sofia.reyes@example.com', 'GBPUSD=X', 5, '10:05', 'BUY', 5000, 0.995),

  -- Thomas Becker: global multi-asset
  ('thomas.becker@example.com', 'SHEL.L', 152, '09:40', 'BUY', 15000, 0.90),
  ('thomas.becker@example.com', 'AAPL', 152, '15:10', 'BUY', 15000, 0.85),
  ('thomas.becker@example.com', 'TCS.NS', 151, '05:20', 'BUY', 12000, 1.03),
  ('thomas.becker@example.com', 'MSFT', 150, '16:45', 'BUY', 15000, 0.87),
  ('thomas.becker@example.com', 'HSBA.L', 148, '10:30', 'BUY', 12000, 0.86),
  ('thomas.becker@example.com', 'EURUSD=X', 147, '11:00', 'BUY', 15000, 0.96),
  ('thomas.becker@example.com', 'AAPL', 125, '14:50', 'BUY', 5000, 0.89),
  ('thomas.becker@example.com', 'TCS.NS', 108, '06:15', 'BUY', 5000, 0.98),
  ('thomas.becker@example.com', 'EURUSD=X', 92, '13:40', 'SELL', 0.5, 0.98),
  ('thomas.becker@example.com', 'MSFT', 84, '17:30', 'BUY', 6000, 0.91),
  ('thomas.becker@example.com', 'HSBA.L', 70, '09:55', 'SELL', 0.3, 0.95),
  ('thomas.becker@example.com', 'AAPL', 59, '15:35', 'BUY', 5000, 0.93),
  ('thomas.becker@example.com', 'TCS.NS', 50, '07:05', 'SELL', 0.4, 0.97),
  ('thomas.becker@example.com', 'SHEL.L', 42, '11:15', 'BUY', 6000, 0.96),
  ('thomas.becker@example.com', 'MSFT', 35, '16:10', 'SELL', 0.25, 0.96),
  ('thomas.becker@example.com', 'EURUSD=X', 26, '12:30', 'BUY', 6000, 0.985),
  ('thomas.becker@example.com', 'HSBA.L', 20, '10:20', 'BUY', 5000, 0.96),
  ('thomas.becker@example.com', 'AAPL', 14, '18:05', 'SELL', 0.2, 0.97),
  ('thomas.becker@example.com', 'TCS.NS', 7, '05:35', 'BUY', 4000, 0.97),
  ('thomas.becker@example.com', 'MSFT', 1, '15:50', 'BUY', 4000, 0.995),

  -- Kai Nakamura: crypto, trades any day of the week
  ('kai.nakamura@example.com', 'BTC-USD', 145, '21:40', 'BUY', 14000, 0.74),
  ('kai.nakamura@example.com', 'ETH-USD', 144, '03:15', 'BUY', 10000, 0.70),
  ('kai.nakamura@example.com', 'ETH-USD', 130, '18:20', 'BUY', 4000, 0.78),
  ('kai.nakamura@example.com', 'BTC-USD', 117, '12:55', 'SELL', 0.4, 0.86),
  ('kai.nakamura@example.com', 'BTC-USD', 106, '22:10', 'BUY', 6000, 0.88),
  ('kai.nakamura@example.com', 'ETH-USD', 93, '07:45', 'SELL', 0.5, 0.92),
  ('kai.nakamura@example.com', 'ETH-USD', 79, '16:30', 'BUY', 5000, 0.97),
  ('kai.nakamura@example.com', 'ETH-USD', 64, '01:20', 'SELL', 0.3, 0.84),
  ('kai.nakamura@example.com', 'BTC-USD', 52, '19:05', 'BUY', 4000, 0.82),
  ('kai.nakamura@example.com', 'ETH-USD', 44, '14:15', 'BUY', 3500, 0.80),
  ('kai.nakamura@example.com', 'BTC-USD', 37, '23:30', 'SELL', 0.3, 0.91),
  ('kai.nakamura@example.com', 'BTC-USD', 28, '10:40', 'BUY', 3000, 0.89),
  ('kai.nakamura@example.com', 'ETH-USD', 22, '20:25', 'SELL', 0.25, 0.95),
  ('kai.nakamura@example.com', 'ETH-USD', 15, '05:50', 'BUY', 3000, 0.93),
  ('kai.nakamura@example.com', 'BTC-USD', 9, '17:35', 'SELL', 0.2, 0.97),
  ('kai.nakamura@example.com', 'BTC-USD', 4, '13:10', 'BUY', 2500, 0.96),
  ('kai.nakamura@example.com', 'ETH-USD', 1, '08:45', 'SELL', 0.15, 1.00);

-- The two customers and who they copy. Only orders placed after started_at are copied.
CREATE TEMP TABLE seed_follower (
    name TEXT, email TEXT, cash NUMERIC
) ON COMMIT DROP;

INSERT INTO seed_follower VALUES
  ('Maya Patel',    'maya.patel@example.com',    30000),
  ('Daniel Okafor', 'daniel.okafor@example.com', 40000);

CREATE TEMP TABLE seed_subscription (
    follower_email TEXT, trader_email TEXT, allocation NUMERIC, days_ago INT, at TIME
) ON COMMIT DROP;

INSERT INTO seed_subscription VALUES
  ('maya.patel@example.com',    'marcus.hale@example.com',       12500, 75, '10:12'),
  ('maya.patel@example.com',    'kai.nakamura@example.com',       6000, 45, '09:30'),
  ('daniel.okafor@example.com', 'eleanor.whitfield@example.com', 15000, 90, '08:05'),
  ('daniel.okafor@example.com', 'thomas.becker@example.com',     12000, 60, '08:40');

DO $$
DECLARE
    r            RECORD;
    s            RECORD;
    v_today      DATE := (now() AT TIME ZONE 'UTC')::date;
    v_price      NUMERIC;
    v_qty        NUMERIC;
    v_pos        NUMERIC;
    v_cash       NUMERIC;
    v_order_id   INT;
    f_qty        NUMERIC;
    f_pos        NUMERIC;
    f_cash       NUMERIC;
    f_at         TIMESTAMPTZ;
    f_order_id   INT;
BEGIN
    IF EXISTS (SELECT 1 FROM copy_trader) THEN
        RAISE EXCEPTION 'Copy trading demo data is already loaded (copy_trader has rows)';
    END IF;
    IF EXISTS (SELECT 1 FROM account a WHERE a.email IN (SELECT email FROM seed_trader UNION SELECT email FROM seed_follower)) THEN
        RAISE EXCEPTION 'A demo account email already exists; nothing was changed';
    END IF;
    IF EXISTS (SELECT 1 FROM seed_trade t LEFT JOIN instrument i ON i.symbol = t.symbol WHERE i.last_price IS NULL) THEN
        RAISE EXCEPTION 'Some instruments are missing or have no price yet: run etl/price_fetcher.py first';
    END IF;

    -- Accounts. Lead traders start with their capital, followers with their cash.
    INSERT INTO account (name, email, cash_balance, created_at)
    SELECT name, email, starting_capital, now() - make_interval(days => days_active) FROM seed_trader;
    INSERT INTO account (name, email, cash_balance, created_at)
    SELECT name, email, cash, now() - interval '95 days' FROM seed_follower;

    INSERT INTO copy_trader (account_id, handle, strategy, markets, bio, risk_level, starting_capital, created_at)
    SELECT a.account_id, t.handle, t.strategy, t.markets, t.bio, t.risk_level, t.starting_capital,
           now() - make_interval(days => t.days_active)
    FROM seed_trader t JOIN account a ON a.email = t.email;

    INSERT INTO copy_subscription (follower_account_id, copy_trader_id, allocation, started_at)
    SELECT f.account_id, ct.copy_trader_id, s.allocation, ((v_today - s.days_ago) + s.at) AT TIME ZONE 'UTC'
    FROM seed_subscription s
    JOIN account f ON f.email = s.follower_email
    JOIN account l ON l.email = s.trader_email
    JOIN copy_trader ct ON ct.account_id = l.account_id;

    -- Every leader order, oldest first, each followed by its copies.
    FOR r IN
        WITH dated AS (
            SELECT t.*, a.account_id, i.instrument_id, i.symbol AS sym, i.last_price, e.name AS exchange_name,
                   ct.copy_trader_id, ct.starting_capital,
                   -- Stock and FX markets are shut at weekends: move those trades back to the Friday.
                   CASE
                       WHEN e.name = 'Binance' THEN v_today - t.days_ago
                       WHEN extract(isodow FROM v_today - t.days_ago) = 6 THEN v_today - t.days_ago - 1
                       WHEN extract(isodow FROM v_today - t.days_ago) = 7 THEN v_today - t.days_ago - 2
                       ELSE v_today - t.days_ago
                   END AS trade_day
            FROM seed_trade t
            JOIN account a ON a.email = t.email
            JOIN copy_trader ct ON ct.account_id = a.account_id
            JOIN instrument i ON i.symbol = t.symbol
            JOIN exchange e ON e.exchange_id = i.exchange_id
        )
        SELECT d.*, (d.trade_day + d.at) AT TIME ZONE 'UTC' AS placed_at
        FROM dated d
        ORDER BY placed_at
    LOOP
        v_price := round(r.last_price * r.factor, CASE WHEN r.last_price < 10 THEN 5 ELSE 2 END);
        SELECT COALESCE((SELECT quantity FROM holdings WHERE account_id = r.account_id AND instrument_id = r.instrument_id), 0)
          INTO v_pos;
        SELECT cash_balance INTO v_cash FROM account WHERE account_id = r.account_id;

        IF r.side = 'BUY' THEN
            v_qty := pg_temp.seed_qty(LEAST(r.amount, v_cash) / v_price, r.exchange_name);
        ELSIF v_pos <= 0 THEN
            CONTINUE;
        ELSIF r.amount >= 1 THEN
            v_qty := v_pos;
        ELSE
            v_qty := LEAST(v_pos, pg_temp.seed_qty(v_pos * r.amount, r.exchange_name));
        END IF;
        IF v_qty <= 0 THEN
            CONTINUE;
        END IF;

        INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, status,
                                  transaction_time, order_type, time_in_force, filled_at)
        VALUES (r.account_id, r.instrument_id, r.side, v_qty, v_price, 'COMPLETE', r.placed_at, 'MARKET', 'DAY', r.placed_at)
        RETURNING transaction_id INTO v_order_id;

        UPDATE account
           SET cash_balance = cash_balance + CASE WHEN r.side = 'BUY' THEN -1 ELSE 1 END * round(v_qty * v_price, 2)
         WHERE account_id = r.account_id;
        INSERT INTO holdings (account_id, instrument_id, symbol, quantity, updated_at)
        VALUES (r.account_id, r.instrument_id, r.sym, CASE WHEN r.side = 'BUY' THEN v_qty ELSE 0 END, r.placed_at)
        ON CONFLICT (account_id, instrument_id) DO UPDATE
           SET quantity = holdings.quantity + CASE WHEN r.side = 'BUY' THEN v_qty ELSE -v_qty END,
               updated_at = EXCLUDED.updated_at;

        -- Copies: same instrument and price, a few seconds later.
        FOR s IN
            SELECT * FROM copy_subscription
            WHERE copy_trader_id = r.copy_trader_id AND started_at <= r.placed_at AND stopped_at IS NULL
            ORDER BY subscription_id
        LOOP
            SELECT COALESCE((SELECT quantity FROM holdings WHERE account_id = s.follower_account_id AND instrument_id = r.instrument_id), 0)
              INTO f_pos;
            SELECT cash_balance INTO f_cash FROM account WHERE account_id = s.follower_account_id;

            IF r.side = 'BUY' THEN
                -- Scaled by allocation / the trader's capital, as far as the follower's cash goes.
                f_qty := trunc(LEAST(v_qty * s.allocation / r.starting_capital, f_cash / v_price), 4);
            ELSIF f_pos <= 0 THEN
                CONTINUE;
            ELSIF v_qty >= v_pos THEN
                f_qty := f_pos;
            ELSE
                -- The same share of the position the trader sold.
                f_qty := LEAST(f_pos, trunc(f_pos * v_qty / v_pos, 4));
            END IF;
            IF f_qty <= 0 THEN
                CONTINUE;
            END IF;

            f_at := r.placed_at + make_interval(secs => 1 + floor(random() * 4));
            INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, status,
                                      transaction_time, order_type, time_in_force, filled_at)
            VALUES (s.follower_account_id, r.instrument_id, r.side, f_qty, v_price, 'COMPLETE', f_at, 'MARKET', 'DAY', f_at)
            RETURNING transaction_id INTO f_order_id;

            UPDATE account
               SET cash_balance = cash_balance + CASE WHEN r.side = 'BUY' THEN -1 ELSE 1 END * round(f_qty * v_price, 2)
             WHERE account_id = s.follower_account_id;
            INSERT INTO holdings (account_id, instrument_id, symbol, quantity, updated_at)
            VALUES (s.follower_account_id, r.instrument_id, r.sym, CASE WHEN r.side = 'BUY' THEN f_qty ELSE 0 END, f_at)
            ON CONFLICT (account_id, instrument_id) DO UPDATE
               SET quantity = holdings.quantity + CASE WHEN r.side = 'BUY' THEN f_qty ELSE -f_qty END,
                   updated_at = EXCLUDED.updated_at;

            INSERT INTO copy_trade (follower_transaction_id, leader_transaction_id, subscription_id)
            VALUES (f_order_id, v_order_id, s.subscription_id);
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- What was loaded: each trader's return at today's prices, and each follower's copies.
SELECT a.name, ct.handle, ct.strategy,
       round((a.cash_balance + COALESCE(SUM(h.quantity * i.last_price), 0)) / ct.starting_capital * 100 - 100, 2) AS return_pct
FROM copy_trader ct
JOIN account a ON a.account_id = ct.account_id
LEFT JOIN holdings h ON h.account_id = a.account_id
LEFT JOIN instrument i ON i.instrument_id = h.instrument_id
GROUP BY a.name, ct.handle, ct.strategy, a.cash_balance, ct.starting_capital
ORDER BY return_pct DESC;

SELECT f.name AS follower, l.name AS copies, s.allocation, COUNT(c.follower_transaction_id) AS copied_orders
FROM copy_subscription s
JOIN account f ON f.account_id = s.follower_account_id
JOIN copy_trader ct ON ct.copy_trader_id = s.copy_trader_id
JOIN account l ON l.account_id = ct.account_id
LEFT JOIN copy_trade c ON c.subscription_id = s.subscription_id
GROUP BY f.name, l.name, s.allocation, s.subscription_id
ORDER BY s.subscription_id;
