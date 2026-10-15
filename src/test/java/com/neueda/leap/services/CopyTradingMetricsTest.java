package com.neueda.leap.services;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The lead trader metrics worked out from an equity curve: no database.
 */
class CopyTradingMetricsTest {

    @Test
    void maxDrawdownIsTheLargestFallFromAPeak() {
        // Peak 120 falls to 90 (25%), later peak 150 falls to 135 (10%).
        List<Double> curve = List.of(100.0, 120.0, 90.0, 150.0, 135.0, 140.0);
        assertEquals(new BigDecimal("25.00"), CopyTradingService.maxDrawdown(curve));
    }

    @Test
    void maxDrawdownIsZeroForACurveThatNeverFalls() {
        assertEquals(new BigDecimal("0.00"), CopyTradingService.maxDrawdown(List.of(100.0, 100.0, 105.0, 110.0)));
    }

    @Test
    void sharpeRatioNeedsEnoughHistory() {
        assertNull(CopyTradingService.sharpeRatio(List.of(100.0, 101.0, 102.0)));
    }

    @Test
    void sharpeRatioIsNullForAFlatCurve() {
        List<Double> flat = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            flat.add(100.0);
        }
        assertNull(CopyTradingService.sharpeRatio(flat));
    }

    @Test
    void sharpeRatioIsPositiveForARisingCurveAndNegativeForAFallingOne() {
        List<Double> rising = new ArrayList<>();
        List<Double> falling = new ArrayList<>();
        double up = 100;
        double down = 100;
        for (int i = 0; i < 60; i++) {
            // Alternating moves so the returns are not all the same.
            up *= i % 2 == 0 ? 1.012 : 0.996;
            down *= i % 2 == 0 ? 0.988 : 1.004;
            rising.add(up);
            falling.add(down);
        }
        assertTrue(CopyTradingService.sharpeRatio(rising).signum() > 0);
        assertTrue(CopyTradingService.sharpeRatio(falling).signum() < 0);
    }
}
