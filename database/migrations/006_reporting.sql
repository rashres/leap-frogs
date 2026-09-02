-- 006_reporting.sql
-- Reporting is logically separate from live transactional tables.

BEGIN;

CREATE MATERIALIZED VIEW reporting.daily_trading_summary AS
SELECT
    date_trunc('day', t.traded_at)::date AS trading_day,
    i.instrument_id,
    i.instrument_code,
    i.asset_class,
    m.market_code,
    cs.segment_code,
    t.side,
    count(*) AS trade_count,
    sum(t.trade_quantity) AS total_quantity,
    sum(t.gross_trade_value) AS total_trade_value,
    sum(t.fee_amount) AS total_fees
FROM trading.trades t
JOIN market_data.instruments i ON i.instrument_id = t.instrument_id
LEFT JOIN market_data.markets m ON m.market_id = i.market_id
JOIN trading.accounts a ON a.account_id = t.account_id
JOIN identity.clients c ON c.client_id = a.client_id
LEFT JOIN identity.client_segments cs ON cs.segment_id = c.segment_id
GROUP BY 1, 2, 3, 4, 5, 6, 7
WITH NO DATA;

CREATE MATERIALIZED VIEW reporting.instrument_activity_summary AS
SELECT
    i.instrument_id,
    i.instrument_code,
    i.instrument_name,
    i.asset_class,
    COALESCE(o.order_count, 0) AS order_count,
    COALESCE(f.fill_count, 0) AS fill_count,
    COALESCE(t.total_quantity, 0) AS total_quantity,
    COALESCE(t.total_trade_value, 0) AS total_trade_value,
    t.last_traded_at
FROM market_data.instruments i
LEFT JOIN (
    SELECT instrument_id, count(*) AS order_count
    FROM trading.orders
    GROUP BY instrument_id
) o ON o.instrument_id = i.instrument_id
LEFT JOIN (
    SELECT instrument_id, count(*) AS fill_count
    FROM trading.fills
    GROUP BY instrument_id
) f ON f.instrument_id = i.instrument_id
LEFT JOIN (
    SELECT instrument_id, sum(trade_quantity) AS total_quantity,
           sum(gross_trade_value) AS total_trade_value, max(traded_at) AS last_traded_at
    FROM trading.trades
    GROUP BY instrument_id
) t ON t.instrument_id = i.instrument_id
WITH NO DATA;

CREATE MATERIALIZED VIEW reporting.client_activity_summary AS
SELECT
    c.client_id,
    c.client_reference,
    cs.segment_code,
    COALESCE(a.account_count, 0) AS account_count,
    COALESCE(o.order_count, 0) AS order_count,
    COALESCE(t.trade_count, 0) AS trade_count,
    COALESCE(t.total_trade_value, 0) AS total_trade_value,
    o.last_order_at
FROM identity.clients c
LEFT JOIN identity.client_segments cs ON cs.segment_id = c.segment_id
LEFT JOIN (
    SELECT client_id, count(*) AS account_count
    FROM trading.accounts
    GROUP BY client_id
) a ON a.client_id = c.client_id
LEFT JOIN (
    SELECT client_id, count(*) AS order_count, max(submitted_at) AS last_order_at
    FROM trading.orders
    GROUP BY client_id
) o ON o.client_id = c.client_id
LEFT JOIN (
    SELECT a.client_id, count(*) AS trade_count, sum(t.gross_trade_value) AS total_trade_value
    FROM trading.trades t
    JOIN trading.accounts a ON a.account_id = t.account_id
    GROUP BY a.client_id
) t ON t.client_id = c.client_id
WITH NO DATA;

CREATE MATERIALIZED VIEW reporting.order_status_summary AS
SELECT
    date_trunc('day', o.submitted_at)::date AS order_day,
    i.asset_class,
    i.instrument_code,
    o.side,
    o.status,
    count(*) AS order_count,
    sum(o.quantity) AS requested_quantity,
    sum(o.filled_quantity) AS filled_quantity
FROM trading.orders o
JOIN market_data.instruments i ON i.instrument_id = o.instrument_id
GROUP BY 1, 2, 3, 4, 5
WITH NO DATA;

CREATE UNIQUE INDEX pk_daily_trading_summary
    ON reporting.daily_trading_summary(trading_day, instrument_id, COALESCE(segment_code, ''), side);
CREATE UNIQUE INDEX pk_instrument_activity_summary
    ON reporting.instrument_activity_summary(instrument_id);
CREATE UNIQUE INDEX pk_client_activity_summary
    ON reporting.client_activity_summary(client_id);
CREATE UNIQUE INDEX pk_order_status_summary
    ON reporting.order_status_summary(order_day, instrument_code, side, status);

CREATE OR REPLACE FUNCTION reporting.refresh_reporting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW reporting.daily_trading_summary;
    REFRESH MATERIALIZED VIEW reporting.instrument_activity_summary;
    REFRESH MATERIALIZED VIEW reporting.client_activity_summary;
    REFRESH MATERIALIZED VIEW reporting.order_status_summary;
END;
$$;

COMMENT ON MATERIALIZED VIEW reporting.daily_trading_summary IS 'Daily trade summary by time period, instrument, market, segment, and side.';
COMMENT ON MATERIALIZED VIEW reporting.instrument_activity_summary IS 'Most-active instrument reporting model.';
COMMENT ON MATERIALIZED VIEW reporting.client_activity_summary IS 'Client activity trend model by client segment.';
COMMENT ON MATERIALIZED VIEW reporting.order_status_summary IS 'Order counts and quantities by status.';

COMMIT;
