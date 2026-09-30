package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Order;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderResponse(
        int orderId,
        int accountId,
        int instrumentId,
        String symbol,
        String side,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal value,
        String status,
        Instant placedTime,
        Instant fulfilledTime
) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getOrderId(),
                order.getAccount().getAccountId(),
                order.getInstrument().getStockId(),
                order.getInstrument().getSymbol(),
                order.getSide(),
                order.getQuantity(),
                order.getPrice(),
                order.getValue(),
                order.getStatus(),
                order.getPlacedTime(),
                order.getFulfilledTime());
    }
}
