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
        // Arrange - use a unique high account ID to avoid test data pollution
        int accountId = 9001;
        orderService.placeOrder(accountId, 1, "BUY", new BigDecimal("5"));  // AAPL
        orderService.placeOrder(accountId, 2, "BUY", new BigDecimal("10")); // MSFT

        // Act
        List<Holding> holdings = holdingService.findByAccountId(accountId);

        // Assert - holdings were retrieved from database
        assertNotNull(holdings);
        assertFalse(holdings.isEmpty(), "Should have at least 1 holding in database");
        
        // Verify specific holdings exist by instrument ID
        var aaplHolding = holdings.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == 1)
                .findFirst();
        var msftHolding = holdings.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == 2)
                .findFirst();
        
        assertTrue(aaplHolding.isPresent(), "Should have AAPL holding");
        assertTrue(msftHolding.isPresent(), "Should have MSFT holding");
        assertEquals(0, new BigDecimal("5").compareTo(aaplHolding.get().getQuantity()),
                "AAPL should have 5 shares");
        assertEquals(0, new BigDecimal("10").compareTo(msftHolding.get().getQuantity()),
                "MSFT should have 10 shares");
    }

    @Test
    @Transactional
    @DisplayName("findByAccountId reflects holdings after multiple buy and sell orders")
    void findByAccountIdReflectsCurrentHoldings() {
        // Arrange - use unique high account ID to avoid test interference
        int accountId = 9002;
        int instrumentId = 1; // AAPL
        orderService.placeOrder(accountId, instrumentId, "BUY", new BigDecimal("20"));  // AAPL: 20 shares

        // Act
        orderService.placeOrder(accountId, instrumentId, "BUY", new BigDecimal("5"));   // AAPL: 25 shares
        orderService.placeOrder(accountId, instrumentId, "SELL", new BigDecimal("3"));  // AAPL: 22 shares

        // Assert
        List<Holding> holdings = holdingService.findByAccountId(accountId);
        
        var aaplHolding = holdings.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == instrumentId)
                .findFirst();
        
        assertTrue(aaplHolding.isPresent(), "Should have AAPL holding");
        
        // Use stripTrailingZeros to handle precision differences (22 vs 22.000000)
        BigDecimal expected = new BigDecimal("22");
        BigDecimal actual = aaplHolding.get().getQuantity();
        assertEquals(0, expected.stripTrailingZeros().compareTo(actual.stripTrailingZeros()),
                "AAPL holding should reflect buy 20 + buy 5 - sell 3 = 22 shares");
    }
}
