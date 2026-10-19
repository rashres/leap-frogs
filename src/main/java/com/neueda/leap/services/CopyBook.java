package com.neueda.leap.services;

import com.neueda.leap.services.domain.CopyLedgerEntry;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What one copy holds, worked out from its own orders only: shares per
 * instrument, what they cost (average cost), and the profit or loss so far.
 * Filled orders move shares; pending ones hold back the cash or shares they
 * will use. Shares the follower bought themselves, or through another copy,
 * never appear here, so a copied sell cannot touch them.
 */
final class CopyBook {

    private static final int SCALE = 8;

    private static final class Position {
        BigDecimal held = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal pendingSells = BigDecimal.ZERO;
        BigDecimal lastPrice;
    }

    private final Map<Integer, Position> positions = new LinkedHashMap<>();
    private BigDecimal realizedPnl = BigDecimal.ZERO;
    private BigDecimal pendingBuys = BigDecimal.ZERO;

    private CopyBook() {
    }

    /** @param entries the copy's filled and pending orders, oldest first */
    static CopyBook of(List<CopyLedgerEntry> entries) {
        CopyBook book = new CopyBook();
        entries.forEach(book::apply);
        return book;
    }

    private void apply(CopyLedgerEntry entry) {
        Position position = positions.computeIfAbsent(entry.getInstrumentId(), id -> new Position());
        if (entry.getLastPrice() != null) {
            position.lastPrice = entry.getLastPrice();
        }
        BigDecimal quantity = entry.getQuantity();
        if ("PENDING".equals(entry.getStatus())) {
            if (entry.isBuy()) {
                BigDecimal price = entry.getLimitPrice() != null ? entry.getLimitPrice() : entry.getPrice();
                pendingBuys = pendingBuys.add(quantity.multiply(price));
            } else {
                position.pendingSells = position.pendingSells.add(quantity);
            }
            return;
        }
        if (!"COMPLETE".equals(entry.getStatus())) {
            return;
        }
        if (entry.isBuy()) {
            position.held = position.held.add(quantity);
            position.cost = position.cost.add(quantity.multiply(entry.getPrice()));
        } else if (position.held.signum() > 0) {
            BigDecimal sold = quantity.min(position.held);
            BigDecimal averageCost = position.cost.divide(position.held, SCALE, RoundingMode.HALF_UP);
            realizedPnl = realizedPnl.add(entry.getPrice().subtract(averageCost).multiply(sold));
            boolean closed = sold.compareTo(position.held) == 0;
            position.held = position.held.subtract(sold);
            // Selling the lot clears its cost exactly, with no rounding left over.
            position.cost = closed ? BigDecimal.ZERO : position.cost.subtract(averageCost.multiply(sold));
        }
    }

    /** Copied shares of the instrument not already held back by a pending copied sell. */
    BigDecimal sellable(int instrumentId) {
        Position position = positions.get(instrumentId);
        return position == null ? BigDecimal.ZERO : position.held.subtract(position.pendingSells).max(BigDecimal.ZERO);
    }

    /** Sellable copied shares per instrument, for instruments with any. */
    Map<Integer, BigDecimal> sellablePositions() {
        Map<Integer, BigDecimal> result = new LinkedHashMap<>();
        positions.keySet().forEach(id -> {
            BigDecimal quantity = sellable(id);
            if (quantity.signum() > 0) {
                result.put(id, quantity);
            }
        });
        return result;
    }

    /** What the copied shares still held cost. */
    BigDecimal invested() {
        return positions.values().stream().map(p -> p.cost).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Copied shares held plus pending copied buys: what counts against the allocation. */
    BigDecimal committed() {
        return invested().add(pendingBuys);
    }

    /** The copied shares at the latest prices (at cost where an instrument has no price). */
    BigDecimal marketValue() {
        return positions.values().stream()
                .map(p -> p.lastPrice == null ? p.cost : p.held.multiply(p.lastPrice))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    BigDecimal realizedPnl() {
        return realizedPnl;
    }

    /** Realized plus unrealized profit or loss of the copy. */
    BigDecimal pnl() {
        return realizedPnl.add(marketValue()).subtract(invested());
    }
}
