-- More instruments: NVIDIA, Alphabet, Meta, JPMorgan Chase and Solana.
-- Safe to run more than once. New databases get this on first boot
-- (docker-compose.yml); for an existing one:
--
--   psql -h localhost -p 8100 -U postgres -d leapfrogsdb -f database/more-instruments.sql
--
-- Added after the original fourteen, so their ids (which tests and seed data
-- rely on) do not change. The API's price updater fills in prices and a year
-- of history for them within a few seconds of starting.

INSERT INTO exchange (name, country)
SELECT 'NYSE', 'USA'
WHERE NOT EXISTS (SELECT 1 FROM exchange WHERE name = 'NYSE');

INSERT INTO instrument (symbol, name, exchange_id)
SELECT v.symbol, v.name, e.exchange_id
FROM (VALUES
    ('NVDA',    'NVIDIA Corporation',    'NASDAQ'),
    ('GOOGL',   'Alphabet Inc.',         'NASDAQ'),
    ('META',    'Meta Platforms, Inc.',  'NASDAQ'),
    ('JPM',     'JPMorgan Chase & Co.',  'NYSE'),
    ('SOL-USD', 'Solana',                'Binance')
) AS v(symbol, name, exchange)
JOIN exchange e ON e.name = v.exchange
WHERE NOT EXISTS (SELECT 1 FROM instrument i WHERE i.symbol = v.symbol);
