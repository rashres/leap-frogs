package com.neueda.leap.services;

import com.neueda.leap.config.AnalyticsDatabase;
import com.neueda.leap.services.domain.Analytics.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;

/**
 * Reporting queries over leap_analytics.fact_trades (completed trades, copied there by the ETL).
 * Every figure is computed from fact_trades so the date and symbol filters apply to all of them.
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    public enum Interval { DAY, WEEK, MONTH }

    private final NamedParameterJdbcTemplate jdbc;

    public AnalyticsService(AnalyticsDatabase database) {
        this.jdbc = database.jdbc();
    }

    public Summary summary(Filter filter) {
        Where where = Where.of(filter);
        return query(() -> jdbc.queryForObject("""
                SELECT COUNT(*)                                                         AS trades,
                       COUNT(*) FILTER (WHERE transaction_type = 'BUY')                 AS buy_trades,
                       COUNT(*) FILTER (WHERE transaction_type = 'SELL')                AS sell_trades,
                       COALESCE(SUM(amount), 0)                                         AS value_traded,
                       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'BUY'), 0)  AS buy_value,
                       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'SELL'), 0) AS sell_value,
                       COUNT(DISTINCT account_id)                                       AS active_clients,
                       COUNT(DISTINCT symbol)                                           AS instruments_traded,
                       (SELECT MAX(refreshed_at) FROM fact_trades)                      AS data_as_of
                FROM fact_trades
                """ + where.sql(), where.params(), (rs, i) -> new Summary(
                filter.from(), filter.to(),
                rs.getLong("trades"), rs.getLong("buy_trades"), rs.getLong("sell_trades"),
                rs.getBigDecimal("value_traded"), rs.getBigDecimal("buy_value"), rs.getBigDecimal("sell_value"),
                rs.getLong("active_clients"), rs.getLong("instruments_traded"),
                instant(rs.getTimestamp("data_as_of")))));
    }

    public List<VolumePoint> volume(Filter filter, Interval interval) {
        Where where = Where.of(filter);
        String unit = interval.name().toLowerCase();
        return query(() -> jdbc.query("""
                SELECT date_trunc('%s', trade_date)::date                                AS period,
                       COUNT(*)                                                         AS trades,
                       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'BUY'), 0)  AS buy_value,
                       COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'SELL'), 0) AS sell_value,
                       SUM(amount)                                                      AS value_traded
                FROM fact_trades
                %s
                GROUP BY 1
                ORDER BY 1
                """.formatted(unit, where.sql()), where.params(), (rs, i) -> new VolumePoint(
                rs.getObject("period", LocalDate.class), rs.getLong("trades"),
                rs.getBigDecimal("buy_value"), rs.getBigDecimal("sell_value"), rs.getBigDecimal("value_traded"))));
    }

    public List<InstrumentActivity> instruments(Filter filter, int limit) {
        Where where = Where.of(filter);
        MapSqlParameterSource params = where.params().addValue("limit", limit);
        return query(() -> jdbc.query("""
                SELECT symbol,
                       MAX(stock_name)                                   AS name,
                       MAX(exchange_name)                                AS exchange,
                       COUNT(*)                                          AS trades,
                       COUNT(*) FILTER (WHERE transaction_type = 'BUY')  AS buy_trades,
                       COUNT(*) FILTER (WHERE transaction_type = 'SELL') AS sell_trades,
                       COUNT(DISTINCT account_id)                        AS clients,
                       SUM(amount)                                       AS value_traded
                FROM fact_trades
                """ + where.sql() + """
                 GROUP BY symbol
                 ORDER BY value_traded DESC, symbol
                 LIMIT :limit
                """, params, (rs, i) -> new InstrumentActivity(
                rs.getString("symbol"), rs.getString("name"), rs.getString("exchange"),
                rs.getLong("trades"), rs.getLong("buy_trades"), rs.getLong("sell_trades"),
                rs.getLong("clients"), rs.getBigDecimal("value_traded"))));
    }

    public List<MarketActivity> markets(Filter filter) {
        Where where = Where.of(filter);
        return query(() -> jdbc.query("""
                SELECT COALESCE(exchange_name, 'Unknown') AS exchange,
                       COUNT(*)                           AS trades,
                       COUNT(DISTINCT symbol)             AS instruments,
                       SUM(amount)                        AS value_traded
                FROM fact_trades
                """ + where.sql() + """
                 GROUP BY 1
                 ORDER BY value_traded DESC
                """, where.params(), (rs, i) -> new MarketActivity(
                rs.getString("exchange"), rs.getLong("trades"), rs.getLong("instruments"),
                rs.getBigDecimal("value_traded"))));
    }

    public List<ClientActivity> clients(Filter filter) {
        Where where = Where.of(filter);
        return query(() -> jdbc.query("""
                SELECT date_trunc('month', trade_date)::date AS month,
                       COUNT(DISTINCT account_id)            AS active_clients,
                       COUNT(*)                              AS trades,
                       SUM(amount)                           AS value_traded
                FROM fact_trades
                """ + where.sql() + """
                 GROUP BY 1
                 ORDER BY 1
                """, where.params(), (rs, i) -> {
            long clients = rs.getLong("active_clients");
            long trades = rs.getLong("trades");
            BigDecimal perClient = clients == 0 ? BigDecimal.ZERO
                    : BigDecimal.valueOf(trades).divide(BigDecimal.valueOf(clients), 2, RoundingMode.HALF_UP);
            return new ClientActivity(rs.getObject("month", LocalDate.class), clients, trades,
                    rs.getBigDecimal("value_traded"), perClient);
        }));
    }

    private <T> T query(Supplier<T> run) {
        try {
            return run.get();
        } catch (DataAccessException e) {
            log.warn("Analytics query failed: {}", e.getMostSpecificCause().getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Reporting data is unavailable. Check that the leap_analytics database exists and the ETL has run.");
        }
    }

    private static Instant instant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    /** WHERE clause for the optional filters, with every value bound as a parameter. */
    private record Where(String sql, MapSqlParameterSource params) {
        static Where of(Filter filter) {
            StringBuilder sql = new StringBuilder();
            MapSqlParameterSource params = new MapSqlParameterSource();
            if (filter.from() != null) {
                sql.append(sql.isEmpty() ? " WHERE " : " AND ").append("trade_date >= :from");
                params.addValue("from", filter.from());
            }
            if (filter.to() != null) {
                sql.append(sql.isEmpty() ? " WHERE " : " AND ").append("trade_date <= :to");
                params.addValue("to", filter.to());
            }
            if (filter.symbol() != null) {
                sql.append(sql.isEmpty() ? " WHERE " : " AND ").append("symbol = :symbol");
                params.addValue("symbol", filter.symbol());
            }
            return new Where(sql.toString(), params);
        }
    }
}
