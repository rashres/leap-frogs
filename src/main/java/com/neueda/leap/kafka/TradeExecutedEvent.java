package com.neueda.leap.kafka;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.neueda.leap.services.domain.Order;

import java.math.BigDecimal;
import java.time.Instant;

public record TradeExecutedEvent(
        // Unique id for the order
        int orderId,
        // Account that placed the order
        int accountId,
        // Instrument being traded
        int instrumentId,
        // Stock symbol, like AAPL
        String symbol,
        // BUY or SELL
        String side,
        // Number of shares or units
        BigDecimal quantity,
        // Price per unit
        BigDecimal price,
        // Total trade value
        BigDecimal value,
        // Time the trade was completed, sent as an ISO-8601 string (e.g. 2026-10-12T14:00:00.123Z)
        // instead of Jackson's default epoch-seconds number
        @JsonFormat(shape = JsonFormat.Shape.STRING)
        Instant executedAt
) {

    // Build an event from an order that is already complete.
    public static TradeExecutedEvent from(Order order) {
        if (!"COMPLETE".equals(order.getStatus())) {
            throw new IllegalArgumentException(
                    "Only COMPLETE orders are trades; order " + order.getOrderId()
                            + " has status " + order.getStatus());
        }
        // Copy values from the order into the event.
        return new TradeExecutedEvent(
                order.getOrderId(),
                order.getAccount().getAccountId(),
                order.getInstrument().getInstrumentId(),
                order.getInstrument().getSymbol(),
                order.getSide(),
                order.getQuantity(),
                order.getPrice(),
                order.getValue(),
                order.getFulfilledTime()
        );
    }
}
