-- More markets and price history for the operational database (leapfrogsdb).
--
-- Safe to run more than once. A fresh Docker volume runs it automatically after
-- capstone-mvp-schema.sql; an existing database needs it applied by hand:
--
--   docker exec -i leap-frogs-postgres psql -U postgres -d leapfrogsdb < database/markets-and-price-history.sql
--
-- Symbols are Yahoo Finance tickers, so etl/price_fetcher.py can price them.
-- Every price is stored in USD; the fetcher converts GBp / INR quotes.

-- ---------------------------------------------------------------------------
-- Exchanges
-- ---------------------------------------------------------------------------
INSERT INTO exchange (name, country)
SELECT v.name, v.country
FROM (VALUES ('LSE', 'UK'), ('NSE', 'India'), ('FX', 'Global')) AS v(name, country)
WHERE NOT EXISTS (SELECT 1 FROM exchange e WHERE e.name = v.name);

-- ---------------------------------------------------------------------------
-- Instruments
-- ---------------------------------------------------------------------------
INSERT INTO instrument (symbol, name, exchange_id)
SELECT v.symbol, v.name, e.exchange_id
FROM (VALUES
        ('SHEL.L',      'Shell plc',                   'LSE'),
        ('HSBA.L',      'HSBC Holdings plc',           'LSE'),
        ('VOD.L',       'Vodafone Group plc',          'LSE'),
        ('RELIANCE.NS', 'Reliance Industries Ltd',     'NSE'),
        ('TCS.NS',      'Tata Consultancy Services',   'NSE'),
        ('INFY.NS',     'Infosys Ltd',                 'NSE'),
        ('EURUSD=X',    'Euro / US Dollar',            'FX'),
        ('GBPUSD=X',    'British Pound / US Dollar',   'FX')
     ) AS v(symbol, name, exchange)
JOIN exchange e ON e.name = v.exchange
ON CONFLICT (symbol, exchange_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Price history
-- ---------------------------------------------------------------------------
-- One row per instrument per minute, in USD, written by etl/price_fetcher.py.
-- instrument.last_price stays the price orders fill at; this table only feeds
-- charts (GET /api/instruments/{id}/prices).
CREATE TABLE IF NOT EXISTS instrument_price (
    instrument_id  INT           NOT NULL REFERENCES instrument(instrument_id),
    observed_at    TIMESTAMPTZ   NOT NULL,
    price          NUMERIC(18,6) NOT NULL CHECK (price > 0),
    PRIMARY KEY (instrument_id, observed_at)
);
