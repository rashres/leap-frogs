package com.neueda.leap.services;

import com.neueda.leap.services.domain.Order;

/**
 * Outcome of placing an order: the saved order, plus the reason when it was rejected (status FAILED).
 */
public record OrderResult(Order order, String rejectionReason) {

    public static OrderResult completed(Order order) {
        return new OrderResult(order, null);
    }

    public static OrderResult rejected(Order order, String reason) {
        return new OrderResult(order, reason);
    }

    public boolean isRejected() {
        return rejectionReason != null;
    }
}
