package com.neueda.leap.kafka;

import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TradeExecutedEvent Tests")
class TradeExecutedEventTest {

    private Order newOrder(String side, String quantity) {
        Account account = new Account(7, "Test User", "test@example.com", new BigDecimal("1000"));
        Instrument instrument = new Instrument(3, "AAPL", "Apple Inc.", 1);
        instrument.setLastPrice(new BigDecimal("10.50"));
        Order order = new Order(account, instrument, side, new BigDecimal(quantity));
        order.setOrderId(101);
        return order;
    }

    @Test
    @DisplayName("Should copy every field from a COMPLETE order")
    void testCompleteOrderMapsAllFields() {
        Order order = newOrder("BUY", "4");
        order.setStatus("COMPLETE");

        TradeExecutedEvent event = TradeExecutedEvent.from(order);

        assertEquals(101, event.orderId());
        assertEquals(7, event.accountId());
        assertEquals(3, event.instrumentId());
        assertEquals("AAPL", event.symbol());
        assertEquals("BUY", event.side());
        assertEquals(new BigDecimal("4"), event.quantity());
        assertEquals(new BigDecimal("10.50"), event.price());
        assertEquals(0, new BigDecimal("42.00").compareTo(event.value()), "value = quantity x price");
        assertNotNull(event.executedAt());
        assertEquals(order.getFulfilledTime(), event.executedAt());
    }

    @Test
    @DisplayName("Should refuse a FAILED order (only completed orders are trades)")
    void testFailedOrderThrows() {
        Order order = newOrder("BUY", "4");
        order.setStatus("FAILED");

        assertThrows(IllegalArgumentException.class, () -> TradeExecutedEvent.from(order));
    }

    @Test
    @DisplayName("Should refuse an order that was never saved")
    void testUnsavedOrderThrows() {
        Order order = newOrder("SELL", "1");

        assertThrows(IllegalArgumentException.class, () -> TradeExecutedEvent.from(order));
    }
}
