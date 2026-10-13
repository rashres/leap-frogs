package com.neueda.leap.services;

import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Works through pending orders on a timer: fills those whose market is open
 * and whose limit is reached at instrument.last_price, and expires DAY orders
 * whose session has closed. Each order is handled in its own transaction, so
 * one bad order does not hold up the rest.
 */
@Component
public class PendingOrderProcessor {

    private static final Logger logger = LoggerFactory.getLogger(PendingOrderProcessor.class);

    private final OrderMapper orderMapper;
    private final OrderService orderService;
    private final boolean enabled;

    public PendingOrderProcessor(OrderMapper orderMapper, OrderService orderService,
                                 @Value("${orders.pending.enabled:true}") boolean enabled) {
        this.orderMapper = orderMapper;
        this.orderService = orderService;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${orders.pending.interval.ms:15000}")
    public void processPendingOrders() {
        if (!enabled) {
            return;
        }
        for (Order order : orderMapper.findPending()) {
            try {
                String status = orderService.processPending(order.getOrderId());
                if (!"PENDING".equals(status)) {
                    logger.info("Pending order {} is now {}", order.getOrderId(), status);
                }
            } catch (RuntimeException e) {
                logger.warn("Could not process pending order {}", order.getOrderId(), e);
            }
        }
    }
}
