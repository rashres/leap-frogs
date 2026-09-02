-- 003_market_data.sql
-- Instruments share common fields; asset-class details live in focused child tables.

BEGIN;

CREATE TABLE market_data.currencies (
    currency_code TEXT PRIMARY KEY,
    currency_name TEXT NOT NULL,
    currency_type TEXT NOT NULL,
    minor_unit SMALLINT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (currency_code = upper(currency_code)),
    CHECK (currency_type IN ('FIAT', 'CRYPTO')),
    CHECK (minor_unit BETWEEN 0 AND 18)
);

CREATE TABLE market_data.markets (
    market_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_code TEXT NOT NULL UNIQUE,
    market_name TEXT NOT NULL,
    country_code TEXT,
    timezone_name TEXT NOT NULL DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (market_code = upper(market_code)),
    CHECK (status IN ('OPEN', 'CLOSED', 'SUSPENDED'))
);

CREATE TABLE market_data.instruments (
    instrument_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_code TEXT NOT NULL UNIQUE,
    asset_class TEXT NOT NULL,
    instrument_name TEXT NOT NULL,
    trading_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    market_id UUID REFERENCES market_data.markets(market_id) ON DELETE RESTRICT,
    ticker_symbol TEXT,
    isin TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    is_tradable BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_order_quantity NUMERIC(28, 10) NOT NULL DEFAULT 0.0000000001,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (instrument_code = upper(instrument_code)),
    CHECK (asset_class IN ('UK_EQUITY', 'US_EQUITY', 'INDIAN_EQUITY', 'FX', 'CRYPTO')),
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'HALTED', 'DELISTED')),
    CHECK (minimum_order_quantity > 0)
);

CREATE TABLE market_data.equity_details (
    instrument_id UUID PRIMARY KEY REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    exchange_code TEXT NOT NULL,
    country_code TEXT NOT NULL,
    lot_size NUMERIC(28, 10) NOT NULL DEFAULT 1,
    sector TEXT,
    CHECK (exchange_code = upper(exchange_code)),
    CHECK (lot_size > 0)
);

CREATE TABLE market_data.fx_pair_details (
    instrument_id UUID PRIMARY KEY REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    base_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    quote_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    pip_size NUMERIC(20, 10) NOT NULL DEFAULT 0.0001,
    CHECK (base_currency_code <> quote_currency_code),
    CHECK (pip_size > 0)
);

CREATE TABLE market_data.crypto_details (
    instrument_id UUID PRIMARY KEY REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    blockchain_network TEXT,
    contract_address TEXT,
    custody_model TEXT NOT NULL DEFAULT 'MOCK_CUSTODY',
    max_decimal_places SMALLINT NOT NULL DEFAULT 8,
    CHECK (max_decimal_places BETWEEN 0 AND 18)
);

CREATE TABLE market_data.quotes (
    quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES market_data.instruments(instrument_id) ON DELETE RESTRICT,
    quote_source TEXT NOT NULL,
    bid_price NUMERIC(28, 10) NOT NULL,
    ask_price NUMERIC(28, 10) NOT NULL,
    mid_price NUMERIC(28, 10) GENERATED ALWAYS AS ((bid_price + ask_price) / 2) STORED,
    quote_currency_code TEXT NOT NULL REFERENCES market_data.currencies(currency_code) ON DELETE RESTRICT,
    quoted_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (bid_price >= 0),
    CHECK (ask_price >= 0),
    CHECK (ask_price >= bid_price),
    CHECK (expires_at > quoted_at)
);

CREATE INDEX idx_instruments_asset_class ON market_data.instruments(asset_class);
CREATE INDEX idx_instruments_market_id ON market_data.instruments(market_id);
CREATE INDEX idx_instruments_ticker ON market_data.instruments(ticker_symbol);
CREATE INDEX idx_quotes_instrument_time ON market_data.quotes(instrument_id, quoted_at DESC);
CREATE INDEX idx_quotes_expiry ON market_data.quotes(instrument_id, expires_at);

COMMENT ON TABLE market_data.instruments IS 'One row per tradable thing, regardless of asset class.';
COMMENT ON TABLE market_data.equity_details IS 'Equity-only attributes, avoiding unrelated nullable columns on instruments.';
COMMENT ON TABLE market_data.fx_pair_details IS 'FX-only attributes, including base and quote currencies.';
COMMENT ON TABLE market_data.crypto_details IS 'Crypto-only attributes.';
COMMENT ON TABLE market_data.quotes IS 'Indicative or execution quotes with source and validity window.';

COMMIT;
