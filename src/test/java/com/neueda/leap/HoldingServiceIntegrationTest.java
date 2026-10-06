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
        // Arrange - use an existing account from the database
        int accountId = 1;
        // Check holdings before adding
        List<Holding> holdingsBefore = holdingService.findByAccountId(accountId);
        int countBefore = holdingsBefore.size();
        
        orderService.placeOrder(accountId, 3, "BUY", new BigDecimal("5"));  // Use instrument 3
        orderService.placeOrder(accountId, 4, "BUY", new BigDecimal("10")); // Use instrument 4

        // Act
        List<Holding> holdingsAfter = holdingService.findByAccountId(accountId);

        // Assert - should have 2 more holdings
        assertNotNull(holdingsAfter);
        assertEquals(countBefore + 2, holdingsAfter.size(), 
                "Should have 2 additional holdings after placing orders");
        
        // Verify specific holdings exist by instrument ID
        var instr3Holding = holdingsAfter.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == 3)
                .findFirst();
        var instr4Holding = holdingsAfter.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == 4)
                .findFirst();
        
        assertTrue(instr3Holding.isPresent(), "Should have instrument 3 holding");
        assertTrue(instr4Holding.isPresent(), "Should have instrument 4 holding");
    }

    @Test
    @Transactional
    @DisplayName("findByAccountId reflects holdings after multiple buy and sell orders")
    void findByAccountIdReflectsCurrentHoldings() {
        // Arrange - use an existing account from the database
        int accountId = 1;
        int instrumentId = 5; // Use a different instrument to avoid conflicts
        
        // Place buy orders
        orderService.placeOrder(accountId, instrumentId, "BUY", new BigDecimal("20"));
        orderService.placeOrder(accountId, instrumentId, "BUY", new BigDecimal("5"));

        // Act - place sell order
        orderService.placeOrder(accountId, instrumentId, "SELL", new BigDecimal("3"));

        // Assert - verify final holdings
        List<Holding> holdings = holdingService.findByAccountId(accountId);
        
        var holding = holdings.stream()
                .filter(h -> h.getInstrument().getInstrumentId() == instrumentId)
                .findFirst();
        
        assertTrue(holding.isPresent(), "Should have holding for instrument " + instrumentId);
        
        // Use stripTrailingZeros to handle precision differences (22 vs 22.000000)
        BigDecimal expected = new BigDecimal("22");
        BigDecimal actual = holding.get().getQuantity();
        assertEquals(0, expected.stripTrailingZeros().compareTo(actual.stripTrailingZeros()),
                "Holding should reflect buy 20 + buy 5 - sell 3 = 22 shares");
    }
}
