package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Aggregated trading activity from the reporting database. Values are in USD,
 * the currency every trade is stored in. Nothing here identifies a client.
 */
public final class Analytics {

    private Analytics() {
    }

    /** Optional filters; null means "no limit". */
    public record Filter(LocalDate from, LocalDate to, String symbol) {}

    public record Summary(
            LocalDate from,
            LocalDate to,
            long trades,
            long buyTrades,
            long sellTrades,
            BigDecimal valueTraded,
            BigDecimal buyValue,
            BigDecimal sellValue,
            long activeClients,
            long instrumentsTraded,
            /** When the ETL last refreshed the reporting data; null if it has never run. */
            Instant dataAsOf) {}

    public record VolumePoint(
            LocalDate period,
            long trades,
            BigDecimal buyValue,
            BigDecimal sellValue,
            BigDecimal valueTraded) {}

    public record InstrumentActivity(
            String symbol,
            String name,
            String exchange,
            long trades,
            long buyTrades,
            long sellTrades,
            long clients,
            BigDecimal valueTraded) {}

    public record MarketActivity(
            String exchange,
            long trades,
            long instruments,
            BigDecimal valueTraded) {}

    public record ClientActivity(
            LocalDate month,
            long activeClients,
            long trades,
            BigDecimal valueTraded,
            BigDecimal avgTradesPerClient) {}

    /** How orders ended up, from fact_orders: every order, whatever its status. */
    public record OrderOutcomes(
            OutcomeCounts totals,
            List<InstrumentOutcomes> instruments,
            /** The latest cancelled and expired orders, newest first. */
            List<ClosedOrder> recentlyClosed) {}

    /** Orders by outcome; rates are percentages of all orders, null when there are none. */
    public record OutcomeCounts(
            long orders,
            long filled,
            long pending,
            long cancelled,
            long expired,
            long rejected,
            BigDecimal fillRate,
            BigDecimal cancelRate) {}

    public record InstrumentOutcomes(
            String symbol,
            String name,
            OutcomeCounts counts) {}

    /** A cancelled or expired order. No account: the dashboard identifies no client. */
    public record ClosedOrder(
            int orderId,
            String symbol,
            String side,
            String orderType,
            String timeInForce,
            String status,
            BigDecimal quantity,
            BigDecimal limitPrice,
            BigDecimal amount,
            Instant placedAt,
            Instant closedAt) {}
}
