package com.neueda.leap.services;

import com.neueda.leap.services.domain.CopyLedgerEntry;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * What a copy holds, worked out from its own orders: no database.
 */
class CopyBookTest {

    private static final int AAPL = 1;
    private static final int MSFT = 2;

    private static CopyLedgerEntry filled(int instrumentId, String side, String quantity, String price, String lastPrice) {
        return new CopyLedgerEntry(instrumentId, side, "COMPLETE", new BigDecimal(quantity), new BigDecimal(price), null,
                new BigDecimal(lastPrice));
    }

    private static CopyLedgerEntry pending(int instrumentId, String side, String quantity, String price, String limitPrice) {
        return new CopyLedgerEntry(instrumentId, side, "PENDING", new BigDecimal(quantity), new BigDecimal(price),
                limitPrice == null ? null : new BigDecimal(limitPrice), new BigDecimal(price));
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), () -> "expected " + expected + " but was " + actual);
    }

    @Test
    void anEmptyBookHoldsNothing() {
        CopyBook book = CopyBook.of(List.of());
        assertMoney("0", book.sellable(AAPL));
        assertMoney("0", book.committed());
        assertMoney("0", book.pnl());
    }

    @Test
    void holdsOnlySharesTheCopyBought() {
        // The follower may hold more AAPL of their own; the book never sees it.
        CopyBook book = CopyBook.of(List.of(filled(AAPL, "BUY", "2", "100", "110")));
        assertMoney("2", book.sellable(AAPL));
        assertMoney("0", book.sellable(MSFT));
        assertMoney("200", book.invested());
        assertMoney("220", book.marketValue());
        assertMoney("20", book.pnl());
    }

    @Test
    void sellsUseAverageCostAndRealizeTheDifference() {
        CopyBook book = CopyBook.of(List.of(
                filled(AAPL, "BUY", "1", "100", "130"),
                filled(AAPL, "BUY", "1", "120", "130"),   // average cost 110
                filled(AAPL, "SELL", "1", "130", "130"))); // +20 realized
        assertMoney("1", book.sellable(AAPL));
        assertMoney("110", book.invested());
        assertMoney("20", book.realizedPnl());
        assertMoney("40", book.pnl()); // 20 realized + (130 - 110) unrealized
    }

    @Test
    void closingAPositionClearsItsCost() {
        CopyBook book = CopyBook.of(List.of(
                filled(AAPL, "BUY", "3", "33.333333", "40"),
                filled(AAPL, "SELL", "3", "40", "40")));
        assertMoney("0", book.sellable(AAPL));
        assertMoney("0", book.invested());
        assertTrue(book.sellablePositions().isEmpty());
    }

    @Test
    void pendingSellsHoldBackSharesAndPendingBuysCountAgainstTheBudget() {
        CopyBook book = CopyBook.of(List.of(
                filled(AAPL, "BUY", "4", "100", "100"),
                pending(AAPL, "SELL", "1", "100", null),
                pending(MSFT, "BUY", "2", "300", "250")));   // a limit buy is reserved at its limit
        assertMoney("3", book.sellable(AAPL));
        assertMoney("0", book.sellable(MSFT));               // not filled yet
        assertMoney("900", book.committed());               // 400 held + 2 x 250 pending
    }

    @Test
    void ignoresFailedAndCancelledOrders() {
        CopyBook book = CopyBook.of(List.of(
                new CopyLedgerEntry(AAPL, "BUY", "FAILED", BigDecimal.TEN, BigDecimal.TEN, null, BigDecimal.TEN),
                new CopyLedgerEntry(AAPL, "BUY", "CANCELLED", BigDecimal.TEN, BigDecimal.TEN, null, BigDecimal.TEN)));
        assertMoney("0", book.sellable(AAPL));
        assertMoney("0", book.committed());
    }
}
