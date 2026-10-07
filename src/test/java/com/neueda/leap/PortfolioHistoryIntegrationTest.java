package com.neueda.leap;

import com.neueda.leap.services.AccountService;
import com.neueda.leap.services.OrderService;
import com.neueda.leap.services.PortfolioHistoryService;
import com.neueda.leap.services.PriceRange;
import com.neueda.leap.services.ResourceNotFoundException;
import com.neueda.leap.services.domain.PortfolioValuePoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for portfolio value history with a real database.
 *
 * Needs the instrument_price table from database/capstone-mvp-schema.sql.
 */
@SpringBootTest
@DisplayName("Portfolio value history Database Integration Tests")
class PortfolioHistoryIntegrationTest {

    @Autowired
    private PortfolioHistoryService portfolioHistoryService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private OrderService orderService;

    @Test
    @DisplayName("value history is evenly spaced, oldest first, and covers the range")
    void valueHistoryCoversRange() {
        for (PriceRange range : PriceRange.values()) {
            List<PortfolioValuePoint> points = portfolioHistoryService.valueHistory(1, range);

            long expected = range.span().dividedBy(range.step()) + 1;
            assertEquals(expected, points.size(), range.code() + " should have one point per step");
            for (int i = 1; i < points.size(); i++) {
                assertEquals(range.step(), Duration.between(points.get(i - 1).at(), points.get(i).at()),
                        range.code() + " points should be one step apart");
            }
            points.forEach(p -> assertTrue(p.holdingsValue().signum() >= 0, "Holdings value cannot be negative"));
        }
    }

    @Test
    @DisplayName("the last point's cash matches the account's current cash")
    void lastPointMatchesCurrentCash() {
        List<PortfolioValuePoint> points = portfolioHistoryService.valueHistory(1, PriceRange.ONE_WEEK);
        PortfolioValuePoint last = points.get(points.size() - 1);

        assertEquals(accountService.findById(1).getCashBalance().setScale(2, RoundingMode.HALF_UP), last.cash());
        assertEquals(last.cash().add(last.holdingsValue()), last.totalValue());
    }

    @Test
    @Transactional
    @DisplayName("an order placed just now shows in the last point")
    void lastPointIncludesOrderPlacedJustNow() {
        orderService.placeOrder(1, 1, "BUY", new BigDecimal("1"));

        List<PortfolioValuePoint> points = portfolioHistoryService.valueHistory(1, PriceRange.ONE_DAY);
        PortfolioValuePoint last = points.get(points.size() - 1);

        assertEquals(accountService.findById(1).getCashBalance().setScale(2, RoundingMode.HALF_UP), last.cash());
    }

    @Test
    @DisplayName("value history throws exception for non-existent account")
    void valueHistoryThrowsForInvalidAccount() {
        assertThrows(ResourceNotFoundException.class,
                () -> portfolioHistoryService.valueHistory(99999, PriceRange.ONE_MONTH));
    }
}
