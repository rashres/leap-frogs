package com.neueda.leap;

import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/** When a limit order may fill, and what a waiting order holds back. No database or Spring context. */
@DisplayName("Limit orders")
class LimitOrderTest {

    private static Order order(String side, String limit) {
        Instrument apple = new Instrument(1, "AAPL", "Apple Inc.", 1);
        apple.setLastPrice(new BigDecimal("200.00"));
        Order order = new Order(new Account(1, "Jane Doe", "jane@example.com", new BigDecimal("10000")),
                apple, side, new BigDecimal("3"));
        if (limit != null) {
            order.setOrderType("LIMIT");
            order.setLimitPrice(new BigDecimal(limit));
        }
        return order;
    }

    @Test
    @DisplayName("a market order fills at any price")
    void marketFillsAtAnyPrice() {
        assertTrue(order("BUY", null).canFillAt(new BigDecimal("999")));
        assertFalse(order("BUY", null).canFillAt(null), "no price, no fill");
    }

    @Test
    @DisplayName("a limit buy fills at or below its limit")
    void limitBuy() {
        Order buy = order("BUY", "180.00");
        assertTrue(buy.canFillAt(new BigDecimal("179.99")));
        assertTrue(buy.canFillAt(new BigDecimal("180.00")));
        assertFalse(buy.canFillAt(new BigDecimal("180.01")));
    }

    @Test
    @DisplayName("a limit sell fills at or above its limit")
    void limitSell() {
        Order sell = order("SELL", "220.00");
        assertTrue(sell.canFillAt(new BigDecimal("220.01")));
        assertTrue(sell.canFillAt(new BigDecimal("220.00")));
        assertFalse(sell.canFillAt(new BigDecimal("219.99")));
    }

    @Test
    @DisplayName("a waiting buy holds back quantity x limit, or quantity x placed price for a market order")
    void reservedValue() {
        assertEquals(0, new BigDecimal("540.00").compareTo(order("BUY", "180.00").getReservedValue()));
        assertEquals(0, new BigDecimal("600.00").compareTo(order("BUY", null).getReservedValue()));
    }

    @Test
    @DisplayName("filling sets the fill price and time")
    void fill() {
        Order buy = order("BUY", "180.00");
        Instant at = Instant.parse("2026-10-14T14:00:00Z");
        buy.fill(new BigDecimal("179.50"), at);
        assertEquals("COMPLETE", buy.getStatus());
        assertEquals(new BigDecimal("179.50"), buy.getPrice());
        assertEquals(at, buy.getFulfilledTime());
        assertEquals(at, buy.getEffectiveTime());
    }
}
