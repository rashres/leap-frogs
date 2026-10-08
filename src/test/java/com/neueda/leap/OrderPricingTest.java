package com.neueda.leap;

import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import com.neueda.leap.services.domain.OrderValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Covers order pricing after market prices moved from the hardcoded
 * MarketService stub to instrument.last_price (fetched by price_fetcher.py).
 *
 * Pure domain objects - no database and no Spring context, so these run
 * anywhere `mvn test` runs.
 */
@DisplayName("Order pricing from instrument.last_price")
class OrderPricingTest {

    private static Instrument instrument(BigDecimal lastPrice) {
        Instrument instrument = new Instrument(1, "AAPL", "Apple Inc.", 1);
        instrument.setLastPrice(lastPrice);
        return instrument;
    }

    private static Account account(String cash) {
        return new Account(1, "Jane Doe", "jane@example.com", new BigDecimal(cash));
    }

    @Test
    @DisplayName("order takes its price from the instrument, not a hardcoded 1.00")
    void orderUsesInstrumentPrice() {
        Instrument apple = instrument(new BigDecimal("333.825012"));

        Order order = new Order(account("100000"), apple, "BUY", new BigDecimal("2"));

        assertEquals(new BigDecimal("333.825012"), order.getPrice());
        assertNotEquals(0, order.getPrice().compareTo(BigDecimal.ONE),
                "price must no longer be the hardcoded $1 stub");
    }

    @Test
    @DisplayName("order value is quantity x market price")
    void orderValueUsesMarketPrice() {
        Order order = new Order(account("100000"), instrument(new BigDecimal("100.50")),
                "BUY", new BigDecimal("3"));

        assertEquals(0, new BigDecimal("301.50").compareTo(order.getValue()));
    }

    @Test
    @DisplayName("price is captured at creation and does not drift with the market")
    void priceIsFixedAtCreation() {
        Instrument apple = instrument(new BigDecimal("300.00"));
        Order order = new Order(account("100000"), apple, "BUY", new BigDecimal("1"));

        apple.setLastPrice(new BigDecimal("450.00")); // market moves after the order

        assertEquals(0, new BigDecimal("300.00").compareTo(order.getPrice()));
    }

    @Test
    @DisplayName("an instrument with no fetched price yields a null order price")
    void unpricedInstrumentGivesNullPrice() {
        Order order = new Order(account("100000"), instrument(null), "BUY", new BigDecimal("1"));

        assertNull(order.getPrice());
    }

    @Test
    @DisplayName("an unpriced order is rejected instead of throwing")
    void unpricedOrderIsRejected() {
        Order order = new Order(account("100000"), instrument(null), "BUY", new BigDecimal("1"));

        assertFalse(OrderValidator.isValidOrder(order),
                "an order with no market price must not be tradeable");
    }

    @Test
    @DisplayName("detailed validation reports the missing price without a NullPointerException")
    void unpricedOrderReportsPriceError() {
        Order order = new Order(account("100000"), instrument(null), "BUY", new BigDecimal("1"));

        OrderValidator.ValidationResult result =
                assertDoesNotThrow(() -> OrderValidator.validateOrderWithDetails(order));

        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("Price"),
                "expected a price error, got: " + result.getErrors());
    }

    @Test
    @DisplayName("null and non-positive prices are not valid prices")
    void priceValidation() {
        assertFalse(OrderValidator.isValidPrice((BigDecimal) null));
        assertFalse(OrderValidator.isValidPrice(BigDecimal.ZERO));
        assertFalse(OrderValidator.isValidPrice(new BigDecimal("-1")));
        assertTrue(OrderValidator.isValidPrice(new BigDecimal("333.825012")));
    }

    @Test
    @DisplayName("a real market price makes an affordable order valid")
    void affordableOrderIsValid() {
        Order order = new Order(account("100000"), instrument(new BigDecimal("333.825012")),
                "BUY", new BigDecimal("2"));

        assertTrue(OrderValidator.isValidOrder(order));
    }

    @Test
    @DisplayName("a real market price makes an unaffordable order invalid")
    void unaffordableOrderIsRejected() {
        // 2 x 333.825012 = 667.65 > 100.00 available
        Order order = new Order(account("100"), instrument(new BigDecimal("333.825012")),
                "BUY", new BigDecimal("2"));

        assertFalse(OrderValidator.isValidOrder(order));
    }
}
