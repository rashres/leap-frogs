package com.neueda.leap.kafka;

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
        // Time the trade was completed
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
                order.getInstrument().getStockId(),
                order.getInstrument().getSymbol(),
                order.getSide(),
                order.getQuantity(),
                order.getPrice(),
                order.getValue(),
                order.getFulfilledTime()
        );
    }
}
