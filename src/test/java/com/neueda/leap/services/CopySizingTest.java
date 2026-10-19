package com.neueda.leap.services;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * How big a copied order is, and when a stop-loss trips: no database.
 */
class CopySizingTest {

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    private static void assertQty(String expected, BigDecimal actual) {
        assertEquals(0, d(expected).compareTo(actual), () -> "expected " + expected + " but was " + actual);
    }

    @Test
    void buyIsScaledByAllocationOverTraderEquity() {
        // Trader with 100k buys 50 shares; a 10k copy buys a tenth of that.
        assertQty("5", CopyTradingService.copiedBuyQuantity(d("50"), d("10000"), d("100000"), d("100"), null, d("10000")));
    }

    @Test
    void buyIsCutToMaxPerTrade() {
        // 5 shares at 100 would cost 500; the cap allows 250.
        assertQty("2.5", CopyTradingService.copiedBuyQuantity(d("50"), d("10000"), d("100000"), d("100"), d("250"), d("10000")));
    }

    @Test
    void buyIsCutToWhatIsLeftOfTheAllocation() {
        assertQty("1.2", CopyTradingService.copiedBuyQuantity(d("50"), d("10000"), d("100000"), d("100"), null, d("120")));
    }

    @Test
    void noBuyOnceTheAllocationIsUsedUp() {
        assertQty("0", CopyTradingService.copiedBuyQuantity(d("50"), d("10000"), d("100000"), d("100"), null, d("-5")));
    }

    @Test
    void noBuyWhenTheTraderHasNoEquity() {
        assertQty("0", CopyTradingService.copiedBuyQuantity(d("50"), d("10000"), d("0"), d("100"), null, d("10000")));
    }

    @Test
    void sellClosesTheSameShareOfTheCopiedPosition() {
        // Trader sells 30 of 120 (a quarter): the copy sells a quarter of its 8.
        assertQty("2", CopyTradingService.copiedSellQuantity(d("8"), d("30"), d("120")));
    }

    @Test
    void sellOfTheWholePositionSellsAllCopiedShares() {
        assertQty("8", CopyTradingService.copiedSellQuantity(d("8"), d("120"), d("120")));
    }

    @Test
    void noSellWithoutCopiedShares() {
        // The trader sells a position they held before the follower joined; the
        // follower's own shares of it are not the copy's to sell.
        assertQty("0", CopyTradingService.copiedSellQuantity(d("0"), d("30"), d("120")));
    }

    @Test
    void stopLossTripsAtItsPercentOfTheAllocation() {
        assertFalse(CopyTradingService.hitsStopLoss(d("-1999.99"), d("10000"), d("20")));
        assertTrue(CopyTradingService.hitsStopLoss(d("-2000"), d("10000"), d("20")));
        assertTrue(CopyTradingService.hitsStopLoss(d("-2500"), d("10000"), d("20")));
    }

    @Test
    void stopLossNeverTripsWithoutOneOrOnAGain() {
        assertFalse(CopyTradingService.hitsStopLoss(d("-9000"), d("10000"), null));
        assertFalse(CopyTradingService.hitsStopLoss(d("500"), d("10000"), d("20")));
    }
}
