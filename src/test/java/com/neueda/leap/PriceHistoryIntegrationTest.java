package com.neueda.leap;

import com.neueda.leap.services.InstrumentService;
import com.neueda.leap.services.PriceRange;
import com.neueda.leap.services.ResourceNotFoundException;
import com.neueda.leap.services.domain.PricePoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for price history with a real database.
 *
 * Needs the instrument_price table from database/capstone-mvp-schema.sql.
 */
@SpringBootTest
@DisplayName("Price history Database Integration Tests")
class PriceHistoryIntegrationTest {

    @Autowired
    private InstrumentService instrumentService;

    @Test
    @DisplayName("price history is oldest first, positive, and within the range")
    void priceHistoryIsOrderedAndWithinRange() {
        for (PriceRange range : PriceRange.values()) {
            List<PricePoint> points = instrumentService.priceHistory(1, range);

            for (int i = 1; i < points.size(); i++) {
                assertTrue(points.get(i).getObservedAt().isAfter(points.get(i - 1).getObservedAt()),
                        range.code() + " points should be oldest first");
            }
            points.forEach(p -> assertTrue(p.getPrice().signum() > 0, "Prices should be positive"));
            if (!points.isEmpty()) {
                Duration covered = Duration.between(points.get(0).getObservedAt(),
                        points.get(points.size() - 1).getObservedAt());
                assertFalse(covered.compareTo(range.span()) > 0, range.code() + " should not exceed its span");
            }
        }
    }

    @Test
    @DisplayName("price history throws exception for non-existent instrument")
    void priceHistoryThrowsForInvalidId() {
        assertThrows(ResourceNotFoundException.class,
                () -> instrumentService.priceHistory(99999, PriceRange.ONE_MONTH));
    }

    @Test
    @DisplayName("ranges are looked up by code, case-insensitively")
    void rangesLookedUpByCode() {
        assertEquals(PriceRange.ONE_DAY, PriceRange.fromCode("1d").orElseThrow());
        assertEquals(PriceRange.ONE_YEAR, PriceRange.fromCode("1Y").orElseThrow());
        assertTrue(PriceRange.fromCode("5Y").isEmpty());
    }
}
