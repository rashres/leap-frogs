package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

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
}
