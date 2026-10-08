package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.OrderResult;
import com.neueda.leap.services.domain.Order;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

@Schema(description = "Order response containing order details and execution status")
public record OrderResponse(
        @Schema(description = "The unique identifier of the order", example = "12345")
        int orderId,
        
        @Schema(description = "The account ID that placed the order", example = "1001")
        int accountId,
        
        @Schema(description = "The instrument/stock ID being traded", example = "1")
        int instrumentId,
        
        @Schema(description = "Stock ticker symbol", example = "AAPL")
        String symbol,
        
        @Schema(description = "Trade direction", example = "BUY")
        String side,
        
        @Schema(description = "Number of shares in the order", example = "100")
        BigDecimal quantity,
        
        @Schema(description = "Price per share", example = "150.50")
        BigDecimal price,
        
        @Schema(description = "Total order value (quantity × price)", example = "15050.00")
        BigDecimal value,
        
        @Schema(description = "Current order status", example = "COMPLETE", allowableValues = {"CREATED", "PENDING", "COMPLETE", "FAILED"})
        String status,
        
        @Schema(description = "Timestamp when order was placed")
        Instant placedTime,
        
        @Schema(description = "Timestamp when order was fulfilled (null if not fulfilled)")
        Instant fulfilledTime,

        @Schema(description = "Why the order was rejected (only set on a FAILED order just submitted)", example = "Insufficient cash: required 500, available 120.00")
        String message
) {
    public static OrderResponse from(Order order) {
        return from(order, null);
    }

    public static OrderResponse from(OrderResult result) {
        return from(result.order(), result.rejectionReason());
    }

    private static OrderResponse from(Order order, String message) {
        return new OrderResponse(
                order.getOrderId(),
                order.getAccount().getAccountId(),
                order.getInstrument().getInstrumentId(),
                order.getInstrument().getSymbol(),
                order.getSide(),
                order.getQuantity(),
                order.getPrice(),
                order.getValue(),
                order.getStatus(),
                order.getPlacedTime(),
                order.getFulfilledTime(),
                message);
    }
}
