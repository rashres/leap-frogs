package com.neueda.leap.kafka;

import com.neueda.leap.services.domain.Order;

public class OrderCompletedEvent {

    // The order that has been completed.
    private final Order order;

    // Create a new completed-order event.
    public OrderCompletedEvent(Order order) {
        this.order = order;
    }

    // Return the completed order.
    public Order getOrder() {
        return order;
    }
}
