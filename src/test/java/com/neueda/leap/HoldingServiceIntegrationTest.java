package com.neueda.leap;

import com.neueda.leap.services.HoldingService;
import com.neueda.leap.services.OrderService;
import com.neueda.leap.services.domain.Holding;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for HoldingService with real database.
 *
 * Verifies that holdings are correctly retrieved from the database
 * and that they reflect the current state after buy/sell orders.
 */
@SpringBootTest
@DisplayName("HoldingService Database Integration Tests")
class HoldingServiceIntegrationTest {

    @Autowired
    private HoldingService holdingService;

    @Autowired
    private OrderService orderService;

    @Test
    @Transactional
    @DisplayName("findByAccountId retrieves all holdings from database")
    void findByAccountIdRetrievesHoldingsFromDatabase() {
        // Arrange
        int accountId = 1;
        orderService.placeOrder(accountId, 1, "BUY", new BigDecimal("5"));  // AAPL
        orderService.placeOrder(accountId, 2, "BUY", new BigDecimal("10")); // MSFT

        // Act
        List<Holding> holdings = holdingService.findByAccountId(accountId);

        // Assert - holdings were retrieved from database
        assertNotNull(holdings);
        assertTrue(holdings.size() >= 2, "Should have at least 2 holdings in database");
        
        // Verify specific holdings exist
        assertTrue(holdings.stream().anyMatch(h -> h.getQuantity().equals(new BigDecimal("5"))),
                "Should have AAPL holding with 5 shares");
        assertTrue(holdings.stream().anyMatch(h -> h.getQuantity().equals(new BigDecimal("10"))),
                "Should have MSFT holding with 10 shares");
    }

    @Test
    @Transactional
    @DisplayName("findByAccountId reflects holdings after multiple buy and sell orders")
    void findByAccountIdReflectsCurrentHoldings() {
        // Arrange
        int accountId = 1;
        orderService.placeOrder(accountId, 1, "BUY", new BigDecimal("20"));  // AAPL: 20 shares

        // Act
        orderService.placeOrder(accountId, 1, "BUY", new BigDecimal("5"));   // AAPL: 25 shares
        orderService.placeOrder(accountId, 1, "SELL", new BigDecimal("3"));  // AAPL: 22 shares

        // Assert
        List<Holding> holdings = holdingService.findByAccountId(accountId);
        
        var aaplHolding = holdings.stream()
                .filter(h -> h.getQuantity().equals(new BigDecimal("22")))
                .findFirst();
        
        assertTrue(aaplHolding.isPresent(), 
                "AAPL holding should reflect buy 20 + buy 5 - sell 3 = 22 shares");
    }
}
