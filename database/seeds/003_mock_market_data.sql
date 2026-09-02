-- 003_mock_market_data.sql
-- Fictional instruments and current quotes across supported asset classes.

BEGIN;

WITH instrument_seed(instrument_code, asset_class, instrument_name, trading_currency_code, market_code, ticker_symbol, isin, base_currency_code, quote_currency_code) AS (
    VALUES
    ('UKEQ001','UK_EQUITY','Fictional Albion Foods','GBP','LSE','ALB1','GB00MOCK0001',NULL,NULL),
    ('UKEQ002','UK_EQUITY','Fictional Thames Robotics','GBP','LSE','THR2','GB00MOCK0002',NULL,NULL),
    ('UKEQ003','UK_EQUITY','Fictional Northstar Retail','GBP','LSE','NST3','GB00MOCK0003',NULL,NULL),
    ('UKEQ004','UK_EQUITY','Fictional Green Grid','GBP','LSE','GRG4','GB00MOCK0004',NULL,NULL),
    ('UKEQ005','UK_EQUITY','Fictional Meadow Bank','GBP','LSE','MDB5','GB00MOCK0005',NULL,NULL),
    ('UKEQ006','UK_EQUITY','Fictional Copper Cloud','GBP','LSE','CPC6','GB00MOCK0006',NULL,NULL),
    ('UKEQ007','UK_EQUITY','Fictional Harbour Health','GBP','LSE','HBH7','GB00MOCK0007',NULL,NULL),
    ('UKEQ008','UK_EQUITY','Fictional Orbit Travel','GBP','LSE','ORB8','GB00MOCK0008',NULL,NULL),
    ('UKEQ009','UK_EQUITY','Fictional Crown Energy','GBP','LSE','CRN9','GB00MOCK0009',NULL,NULL),
    ('UKEQ010','UK_EQUITY','Fictional Pennine Media','GBP','LSE','PNM0','GB00MOCK0010',NULL,NULL),
    ('UKEQ011','UK_EQUITY','Fictional Severn Software','GBP','LSE','SVS1','GB00MOCK0011',NULL,NULL),
    ('UKEQ012','UK_EQUITY','Fictional Wren Logistics','GBP','LSE','WRL2','GB00MOCK0012',NULL,NULL),
    ('UKEQ013','UK_EQUITY','Fictional Cedar Homes','GBP','LSE','CDH3','GB00MOCK0013',NULL,NULL),
    ('UKEQ014','UK_EQUITY','Fictional Violet Telecom','GBP','LSE','VLT4','GB00MOCK0014',NULL,NULL),
    ('UKEQ015','UK_EQUITY','Fictional Finch Water','GBP','LSE','FNW5','GB00MOCK0015',NULL,NULL),
    ('USEQ001','US_EQUITY','Fictional Pacific Devices','USD','NASDAQ','PCD1','US00MOCK0001',NULL,NULL),
    ('USEQ002','US_EQUITY','Fictional Summit AI','USD','NASDAQ','SAI2','US00MOCK0002',NULL,NULL),
    ('USEQ003','US_EQUITY','Fictional Canyon Motors','USD','NASDAQ','CYM3','US00MOCK0003',NULL,NULL),
    ('USEQ004','US_EQUITY','Fictional Atlas Streaming','USD','NASDAQ','ATS4','US00MOCK0004',NULL,NULL),
    ('USEQ005','US_EQUITY','Fictional Redwood Security','USD','NASDAQ','RWS5','US00MOCK0005',NULL,NULL),
    ('USEQ006','US_EQUITY','Fictional Bluefin Chips','USD','NASDAQ','BFC6','US00MOCK0006',NULL,NULL),
    ('USEQ007','US_EQUITY','Fictional Desert Pharma','USD','NASDAQ','DSP7','US00MOCK0007',NULL,NULL),
    ('USEQ008','US_EQUITY','Fictional Glacier Data','USD','NASDAQ','GLD8','US00MOCK0008',NULL,NULL),
    ('USEQ009','US_EQUITY','Fictional Prairie Solar','USD','NASDAQ','PRS9','US00MOCK0009',NULL,NULL),
    ('USEQ010','US_EQUITY','Fictional Maple Payments','USD','NASDAQ','MPP0','US00MOCK0010',NULL,NULL),
    ('USEQ011','US_EQUITY','Fictional Aurora Games','USD','NASDAQ','ARG1','US00MOCK0011',NULL,NULL),
    ('USEQ012','US_EQUITY','Fictional Harbor Freight Tech','USD','NASDAQ','HFT2','US00MOCK0012',NULL,NULL),
    ('USEQ013','US_EQUITY','Fictional Meridian Cloud','USD','NASDAQ','MRC3','US00MOCK0013',NULL,NULL),
    ('USEQ014','US_EQUITY','Fictional Boulder Robotics','USD','NASDAQ','BDR4','US00MOCK0014',NULL,NULL),
    ('USEQ015','US_EQUITY','Fictional Silverline Health','USD','NASDAQ','SLH5','US00MOCK0015',NULL,NULL),
    ('INEQ001','INDIAN_EQUITY','Fictional Deccan Foods','INR','NSE','DCF1','IN00MOCK0001',NULL,NULL),
    ('INEQ002','INDIAN_EQUITY','Fictional Ganga Software','INR','NSE','GNS2','IN00MOCK0002',NULL,NULL),
    ('INEQ003','INDIAN_EQUITY','Fictional Lotus Mobility','INR','NSE','LTM3','IN00MOCK0003',NULL,NULL),
    ('INEQ004','INDIAN_EQUITY','Fictional Monsoon Energy','INR','NSE','MNE4','IN00MOCK0004',NULL,NULL),
    ('INEQ005','INDIAN_EQUITY','Fictional Peacock Finance','INR','NSE','PKF5','IN00MOCK0005',NULL,NULL),
    ('INEQ006','INDIAN_EQUITY','Fictional Banyan Retail','INR','NSE','BYR6','IN00MOCK0006',NULL,NULL),
    ('INEQ007','INDIAN_EQUITY','Fictional Saffron Telecom','INR','NSE','SFT7','IN00MOCK0007',NULL,NULL),
    ('INEQ008','INDIAN_EQUITY','Fictional Himalaya Pharma','INR','NSE','HMP8','IN00MOCK0008',NULL,NULL),
    ('INEQ009','INDIAN_EQUITY','Fictional Coastal Cement','INR','NSE','CCM9','IN00MOCK0009',NULL,NULL),
    ('INEQ010','INDIAN_EQUITY','Fictional Indigo Logistics','INR','NSE','IDL0','IN00MOCK0010',NULL,NULL),
    ('FXGBPUSD','FX','Mock GBP/USD Spot','USD','FX24','GBPUSD',NULL,'GBP','USD'),
    ('FXEURUSD','FX','Mock EUR/USD Spot','USD','FX24','EURUSD',NULL,'EUR','USD'),
    ('FXUSDINR','FX','Mock USD/INR Spot','INR','FX24','USDINR',NULL,'USD','INR'),
    ('FXGBPINR','FX','Mock GBP/INR Spot','INR','FX24','GBPINR',NULL,'GBP','INR'),
    ('FXEURGBP','FX','Mock EUR/GBP Spot','GBP','FX24','EURGBP',NULL,'EUR','GBP'),
    ('CRYPTO001','CRYPTO','Mock Bitcoin Asset','USD','CRYPTO24','MBTC',NULL,NULL,NULL),
    ('CRYPTO002','CRYPTO','Mock Ether Asset','USD','CRYPTO24','METH',NULL,NULL,NULL),
    ('CRYPTO003','CRYPTO','Mock Sol Asset','USD','CRYPTO24','MSOL',NULL,NULL,NULL),
    ('CRYPTO004','CRYPTO','Mock Polygon Asset','USD','CRYPTO24','MPOL',NULL,NULL,NULL),
    ('CRYPTO005','CRYPTO','Mock Stellar Asset','USD','CRYPTO24','MSTR',NULL,NULL,NULL)
),
inserted AS (
    INSERT INTO market_data.instruments (
        instrument_code, asset_class, instrument_name, trading_currency_code,
        market_id, ticker_symbol, isin, status, is_tradable
    )
    SELECT
        s.instrument_code, s.asset_class, s.instrument_name, s.trading_currency_code,
        m.market_id, s.ticker_symbol, s.isin, 'ACTIVE', TRUE
    FROM instrument_seed s
    JOIN market_data.markets m ON m.market_code = s.market_code
    RETURNING instrument_id, instrument_code, asset_class
)
INSERT INTO market_data.equity_details (instrument_id, exchange_code, country_code, lot_size, sector)
SELECT i.instrument_id, s.market_code, CASE WHEN s.asset_class = 'UK_EQUITY' THEN 'GB' WHEN s.asset_class = 'US_EQUITY' THEN 'US' ELSE 'IN' END, 1,
       (ARRAY['Technology','Financials','Consumer','Energy','Healthcare'])[1 + ((row_number() OVER ())::int % 5)]
FROM inserted i
JOIN instrument_seed s ON s.instrument_code = i.instrument_code
WHERE i.asset_class IN ('UK_EQUITY', 'US_EQUITY', 'INDIAN_EQUITY');

WITH seed AS (
    SELECT i.instrument_id, i.instrument_code, s.base_currency_code, s.quote_currency_code
    FROM market_data.instruments i
    JOIN (
        VALUES
        ('FXGBPUSD','GBP','USD'), ('FXEURUSD','EUR','USD'), ('FXUSDINR','USD','INR'),
        ('FXGBPINR','GBP','INR'), ('FXEURGBP','EUR','GBP')
    ) AS s(instrument_code, base_currency_code, quote_currency_code)
    ON s.instrument_code = i.instrument_code
)
INSERT INTO market_data.fx_pair_details (instrument_id, base_currency_code, quote_currency_code, pip_size)
SELECT instrument_id, base_currency_code, quote_currency_code, 0.0001
FROM seed;

INSERT INTO market_data.crypto_details (instrument_id, blockchain_network, custody_model, max_decimal_places)
SELECT instrument_id,
       CASE instrument_code WHEN 'CRYPTO001' THEN 'Mock Bitcoin Network' WHEN 'CRYPTO002' THEN 'Mock Ethereum Network' ELSE 'Mock Multi Asset Network' END,
       'MOCK_CUSTODY',
       8
FROM market_data.instruments
WHERE asset_class = 'CRYPTO';

INSERT INTO market_data.quotes (
    instrument_id, quote_source, bid_price, ask_price, quote_currency_code, quoted_at, expires_at
)
SELECT
    instrument_id,
    'MOCK_PRICE_FEED',
    round(base_price * 0.999, 10),
    round(base_price * 1.001, 10),
    trading_currency_code,
    now() - interval '5 minutes',
    now() + interval '1 day'
FROM (
    SELECT
        instrument_id,
        trading_currency_code,
        CASE asset_class
            WHEN 'UK_EQUITY' THEN 3 + row_number() OVER (PARTITION BY asset_class ORDER BY instrument_code) * 1.75
            WHEN 'US_EQUITY' THEN 20 + row_number() OVER (PARTITION BY asset_class ORDER BY instrument_code) * 6.25
            WHEN 'INDIAN_EQUITY' THEN 100 + row_number() OVER (PARTITION BY asset_class ORDER BY instrument_code) * 22.5
            WHEN 'FX' THEN 0.75 + row_number() OVER (PARTITION BY asset_class ORDER BY instrument_code) * 0.25
            ELSE 15 + row_number() OVER (PARTITION BY asset_class ORDER BY instrument_code) * 1250
        END::numeric AS base_price
    FROM market_data.instruments
) priced;

COMMIT;
