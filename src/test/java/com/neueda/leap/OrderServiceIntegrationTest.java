package com.neueda.leap;

import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.AccountService;
import com.neueda.leap.services.OrderResult;
import com.neueda.leap.services.OrderService;
import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Holding;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for OrderService with real database.
 *
 * Verifies that:
 * - Orders are persisted to the transactions table
 * - Account cash balance is updated correctly
 * - Holdings are created/updated in the holdings table
 * - Failed orders are marked with status FAILED and don't affect balances
 *
 * Uses @Transactional to automatically rollback changes after each test.
 */
@SpringBootTest
@DisplayName("OrderService Database Integration Tests")
class OrderServiceIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private HoldingsMapper holdingsMapper;

    @Autowired
    private AccountMapper accountMapper;

    @Test
    @Transactional
    @DisplayName("placeOrder inserts order into database with COMPLETE status")
    void placeOrderInsertsOrderToDatabase() {
        // Arrange
        int accountId = 1;
        int instrumentId = 1; // AAPL
        BigDecimal quantity = new BigDecimal("5");

        Account beforeAccount = accountService.findById(accountId);
        BigDecimal beforeBalance = beforeAccount.getCashBalance();

        // Act
        OrderResult result = orderService.placeOrder(accountId, instrumentId, "BUY", quantity);

        // Assert - order was created and completed
        assertFalse(result.isRejected(), "Order should be successful");
        assertEquals("COMPLETE", result.order().getStatus());

        // Assert - order was inserted into database
        List<Order> orders = orderMapper.findByAccountId(accountId);
        assertFalse(orders.isEmpty(), "Should have at least one order in database");
        Order dbOrder = orders.get(0);
        assertEquals("BUY", dbOrder.getSide());
        assertEquals(quantity, dbOrder.getQuantity());
        assertEquals("COMPLETE", dbOrder.getStatus());
    }

    @Test
    @Transactional
    @DisplayName("placeOrder BUY reduces account cash balance and persists to database")
    void placeOrderBuyUpdatesAccountBalance() {
        // Arrange
        int accountId = 1;
        int instrumentId = 1; // AAPL with ~$333 price
        BigDecimal quantity = new BigDecimal("2");

        Account beforeAccount = accountService.findById(accountId);
        BigDecimal beforeBalance = beforeAccount.getCashBalance();

        // Act
        orderService.placeOrder(accountId, instrumentId, "BUY", quantity);

        // Assert - balance is reduced in database
        Account afterAccount = accountMapper.findById(accountId);
        assertTrue(afterAccount.getCashBalance().compareTo(beforeBalance) < 0,
                "Cash balance should decrease after BUY order");
    }

    @Test
    @Transactional
    @DisplayName("placeOrder creates or updates holding in database")
    void placeOrderUpdatesHoldings() {
        // Arrange
        int accountId = 1;
        int instrumentId = 1; // AAPL
        BigDecimal quantity = new BigDecimal("3");

        Holding beforeHolding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        BigDecimal beforeQuantity = beforeHolding == null ? BigDecimal.ZERO : beforeHolding.getQuantity();

        // Act
        orderService.placeOrder(accountId, instrumentId, "BUY", quantity);

        // Assert - holding was updated in database
        Holding afterHolding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        assertNotNull(afterHolding, "Holding should exist in database after BUY");
        assertEquals(beforeQuantity.add(quantity), afterHolding.getQuantity(),
                "Holding quantity should increase by order quantity");
    }

    @Test
    @Transactional
    @DisplayName("placeOrder with insufficient cash creates FAILED order and doesn't update balances")
    void placeOrderFailsWithInsufficientCash() {
        // Arrange
        int accountId = 1;
        int instrumentId = 1; // AAPL
        BigDecimal largeQuantity = new BigDecimal("100000"); // Too much to afford

        Account beforeAccount = accountService.findById(accountId);
        BigDecimal beforeBalance = beforeAccount.getCashBalance();

        Holding beforeHolding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        BigDecimal beforeQuantity = beforeHolding == null ? BigDecimal.ZERO : beforeHolding.getQuantity();

        // Act
        OrderResult result = orderService.placeOrder(accountId, instrumentId, "BUY", largeQuantity);

        // Assert - order was created but rejected
        assertTrue(result.isRejected(), "Order should fail due to insufficient funds");
        assertEquals("FAILED", result.order().getStatus());
        assertNotNull(result.rejectionReason());

        // Assert - balances were not affected
        Account afterAccount = accountMapper.findById(accountId);
        assertEquals(beforeBalance, afterAccount.getCashBalance(),
                "Cash balance should not change for failed order");

        Holding afterHolding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        BigDecimal afterQuantity = afterHolding == null ? BigDecimal.ZERO : afterHolding.getQuantity();
        assertEquals(beforeQuantity, afterQuantity,
                "Holdings should not change for failed order");
    }

    @Test
    @Transactional
    @DisplayName("placeOrder SELL reduces holding quantity in database")
    void placeOrderSellReducesHoldings() {
        // Arrange - first create a holding by buying
        int accountId = 1;
        int instrumentId = 1;
        orderService.placeOrder(accountId, instrumentId, "BUY", new BigDecimal("10"));

        Holding holdingAfterBuy = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        BigDecimal quantityAfterBuy = holdingAfterBuy.getQuantity();

        // Act - sell part of the holding
        orderService.placeOrder(accountId, instrumentId, "SELL", new BigDecimal("3"));

        // Assert - holding quantity was reduced
        Holding holdingAfterSell = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        assertEquals(quantityAfterBuy.subtract(new BigDecimal("3")), holdingAfterSell.getQuantity(),
                "Holding quantity should decrease by sell quantity");
    }

    @Test
    @Transactional
    @DisplayName("placeOrder with insufficient shares to sell creates FAILED order")
    void placeOrderFailsWithInsufficientShares() {
        // Arrange
        int accountId = 1;
        int instrumentId = 1;
        // We don't set up any BUY orders, so account has 0 shares

        Account beforeAccount = accountService.findById(accountId);
        BigDecimal beforeBalance = beforeAccount.getCashBalance();

        // Act - try to sell 100 shares we don't have
        OrderResult result = orderService.placeOrder(accountId, instrumentId, "SELL", new BigDecimal("100"));

        // Assert - order was rejected
        assertTrue(result.isRejected(), "SELL order should fail with insufficient shares");
        assertEquals("FAILED", result.order().getStatus());

        // Assert - balance unchanged
        Account afterAccount = accountMapper.findById(accountId);
        assertEquals(beforeBalance, afterAccount.getCashBalance(),
                "Balance should not change for failed SELL order");
    }

    @Test
    @Transactional
    @DisplayName("findByAccountId returns all orders for account from database")
    void findByAccountIdReturnAllOrdersFromDatabase() {
        // Arrange
        int accountId = 1;
        List<Order> ordersBefore = orderMapper.findByAccountId(accountId);
        int countBefore = ordersBefore.size();

        // Act - place multiple orders
        orderService.placeOrder(accountId, 1, "BUY", new BigDecimal("2"));
        orderService.placeOrder(accountId, 2, "BUY", new BigDecimal("5"));

        // Assert - database now has more orders
        List<Order> ordersAfter = orderMapper.findByAccountId(accountId);
        assertEquals(countBefore + 2, ordersAfter.size(),
                "Should have 2 additional orders in database");
    }
}
