package com.neueda.leap;

import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.InstrumentService;
import com.neueda.leap.services.InvalidOrderException;
import com.neueda.leap.services.OrderNotCancellableException;
import com.neueda.leap.services.OrderResult;
import com.neueda.leap.services.OrderService;
import com.neueda.leap.services.ResourceNotFoundException;
import com.neueda.leap.services.domain.Holding;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pending orders against the real database, with trading hours on and a clock
 * the test sets. Trades AAPL (NASDAQ, 09:30-16:00 New York = 13:30-20:00 UTC in
 * October) on account 1; every test rolls back.
 */
@SpringBootTest(properties = "market.hours.enforced=true")
@Import(PendingOrderIntegrationTest.TestClockConfig.class)
@Transactional
@DisplayName("Pending, limit and cancelled orders")
class PendingOrderIntegrationTest {

    private static final int ACCOUNT = 1;
    private static final int AAPL = 1;
    private static final BigDecimal TWO = new BigDecimal("2");
    private static final Instant SATURDAY = Instant.parse("2026-10-17T15:00:00Z");
    private static final Instant MONDAY_OPEN = Instant.parse("2026-10-19T15:00:00Z");
    private static final Instant MONDAY_CLOSE = Instant.parse("2026-10-19T20:00:00Z");
    private static final Instant TUESDAY_OPEN = Instant.parse("2026-10-20T15:00:00Z");

    /** A clock the test moves by hand. */
    static class SettableClock extends Clock {
        private Instant now = Instant.now();

        void set(Instant now) {
            this.now = now;
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    @TestConfiguration
    static class TestClockConfig {
        @Bean
        @Primary
        SettableClock settableClock() {
            return new SettableClock();
        }
    }

    @Autowired private SettableClock clock;
    @Autowired private OrderService orderService;
    @Autowired private OrderMapper orderMapper;
    @Autowired private AccountMapper accountMapper;
    @Autowired private HoldingsMapper holdingsMapper;
    @Autowired private InstrumentService instrumentService;

    private BigDecimal price;

    @BeforeEach
    void setUp() {
        price = instrumentService.findById(AAPL).getPrice();
        assertNotNull(price, "AAPL needs a price; run the price fetcher first");
    }

    private BigDecimal cash() {
        return accountMapper.findById(ACCOUNT).getCashBalance();
    }

    private BigDecimal held() {
        Holding holding = holdingsMapper.findByAccountIdAndInstrumentId(ACCOUNT, AAPL);
        return holding == null ? BigDecimal.ZERO : holding.getQuantity();
    }

    private Order limit(String side, BigDecimal limitPrice, String timeInForce) {
        OrderResult result = orderService.placeOrder(ACCOUNT, AAPL, side, BigDecimal.ONE, "LIMIT", limitPrice, timeInForce);
        assertFalse(result.isRejected(), () -> "rejected: " + result.rejectionReason());
        return result.order();
    }

    @Test
    @DisplayName("a market order placed while the market is closed waits, holding back cash, until the next close")
    void marketOrderWaitsWhileClosed() {
        clock.set(SATURDAY);
        BigDecimal cashBefore = cash();

        OrderResult result = orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE);

        assertEquals("PENDING", result.order().getStatus());
        assertEquals(MONDAY_CLOSE, result.order().getExpiresAt());
        assertEquals(0, cashBefore.compareTo(cash()), "cash moves only when it fills");
        assertEquals(0, price.compareTo(orderMapper.reservedCash(ACCOUNT)));
    }

    @Test
    @DisplayName("a limit buy below the market waits while the market is open; GTC has no expiry")
    void limitBuyWaitsUntilReached() {
        clock.set(MONDAY_OPEN);
        Order order = limit("BUY", price.divide(TWO, 2, RoundingMode.DOWN), "GTC");

        assertEquals("PENDING", order.getStatus());
        assertNull(order.getExpiresAt());
    }

    @Test
    @DisplayName("a limit buy at or above the market fills straight away at the market price")
    void marketableLimitFillsNow() {
        clock.set(MONDAY_OPEN);
        Order order = limit("BUY", price.multiply(TWO), "DAY");

        assertEquals("COMPLETE", order.getStatus());
        assertEquals(0, price.compareTo(order.getPrice()), "fills at the market, not the limit");
    }

    @Test
    @DisplayName("cash held back by a pending buy cannot be spent again")
    void reservedCashIsNotAvailable() {
        clock.set(MONDAY_OPEN);
        BigDecimal affordable = cash().divide(price, 0, RoundingMode.DOWN);
        // Reserve nearly all the cash with a limit buy that will not fill yet.
        orderService.placeOrder(ACCOUNT, AAPL, "BUY", affordable, "LIMIT", price.multiply(new BigDecimal("0.99")), "DAY");

        OrderResult second = orderService.placeOrder(ACCOUNT, AAPL, "BUY", TWO);

        assertTrue(second.isRejected(), "the reserved cash must not be spent twice");
        assertEquals("FAILED", second.order().getStatus());
    }

    @Test
    @DisplayName("shares held back by a pending sell cannot be sold again")
    void reservedSharesAreNotAvailable() {
        clock.set(MONDAY_OPEN);
        orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE);
        BigDecimal all = held();
        orderService.placeOrder(ACCOUNT, AAPL, "SELL", all, "LIMIT", price.multiply(TWO), "GTC");

        OrderResult second = orderService.placeOrder(ACCOUNT, AAPL, "SELL", BigDecimal.ONE);

        assertTrue(second.isRejected());
    }

    @Test
    @DisplayName("cancelling releases the order; it cannot be cancelled twice or by another account")
    void cancel() {
        clock.set(SATURDAY);
        Order order = orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE).order();

        assertThrows(ResourceNotFoundException.class, () -> orderService.cancelOrder(2, order.getOrderId()));

        Order cancelled = orderService.cancelOrder(ACCOUNT, order.getOrderId());
        assertEquals("CANCELLED", cancelled.getStatus());
        assertEquals("CANCELLED", orderMapper.findById(order.getOrderId()).getStatus());
        assertEquals(SATURDAY, orderMapper.findById(order.getOrderId()).getClosedAt(), "records when it was cancelled");
        assertEquals(0, BigDecimal.ZERO.compareTo(orderMapper.reservedCash(ACCOUNT)));

        assertThrows(OrderNotCancellableException.class, () -> orderService.cancelOrder(ACCOUNT, order.getOrderId()));
        clock.set(MONDAY_OPEN);
        assertEquals("CANCELLED", orderService.processPending(order.getOrderId()), "a cancelled order never fills");
    }

    @Test
    @DisplayName("a pending order fills once its market opens, moving cash and shares")
    void fillsAtOpen() {
        clock.set(SATURDAY);
        Order order = orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE).order();
        BigDecimal cashBefore = cash();
        BigDecimal heldBefore = held();

        assertEquals("PENDING", orderService.processPending(order.getOrderId()), "still closed");

        clock.set(MONDAY_OPEN);
        assertEquals("COMPLETE", orderService.processPending(order.getOrderId()));

        Order filled = orderMapper.findById(order.getOrderId());
        assertEquals(MONDAY_OPEN, filled.getFulfilledTime());
        BigDecimal expectedCash = cashBefore.subtract(price).setScale(2, RoundingMode.HALF_UP);
        assertEquals(0, expectedCash.compareTo(cash()));
        assertEquals(0, heldBefore.add(BigDecimal.ONE).compareTo(held()));
    }

    @Test
    @DisplayName("a DAY order that has not filled by its session close expires")
    void dayOrderExpires() {
        clock.set(MONDAY_OPEN);
        Order order = limit("BUY", price.divide(TWO, 2, RoundingMode.DOWN), "DAY");
        assertEquals(MONDAY_CLOSE, order.getExpiresAt());

        clock.set(TUESDAY_OPEN);
        assertEquals("EXPIRED", orderService.processPending(order.getOrderId()));
        assertEquals(TUESDAY_OPEN, orderMapper.findById(order.getOrderId()).getClosedAt(), "records when it expired");
        assertEquals(0, BigDecimal.ZERO.compareTo(orderMapper.reservedCash(ACCOUNT)));
    }

    @Test
    @DisplayName("bad combinations are refused outright")
    void invalidCombinations() {
        assertThrows(InvalidOrderException.class,
                () -> orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE, "MARKET", null, "GTC"));
        assertThrows(InvalidOrderException.class,
                () -> orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE, "LIMIT", null, "DAY"));
        assertThrows(InvalidOrderException.class,
                () -> orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE, "MARKET", BigDecimal.TEN, "DAY"));
        assertThrows(InvalidOrderException.class,
                () -> orderService.placeOrder(ACCOUNT, AAPL, "BUY", BigDecimal.ONE, "STOP", null, "DAY"));
    }
}
