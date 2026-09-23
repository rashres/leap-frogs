package com.neueda.leap;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

public class Holding {
    private int holdingId;
    private int accountId;
    private Instrument instrument;
    private BigDecimal quantity = BigDecimal.ZERO;
    private BigDecimal costBasis = BigDecimal.ZERO.setScale(2);
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public Holding() {
    }

    public Holding( int accountId, Instrument instrument, BigDecimal quantity) {
        this.accountId = accountId;
        this.instrument = instrument;
        this.quantity = quantity;
    }

    public int getHoldingId() {
        return holdingId;
    }

    public void setHoldingId(int holdingId) {
        this.holdingId = holdingId;
    }

    public int getAccountId() {
        return accountId;
    }

    public void setAccountId(int accountId) {
        this.accountId = accountId;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public void setInstrument(Instrument instrument) {
        this.instrument = instrument;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public void updateQuantity(String side, BigDecimal quantity) {
        switch (side) {
            case "BUY":
                this.quantity = this.quantity.add(quantity);
                break;
            case "SELL":
                this.quantity = this.quantity.subtract(quantity);
                break;
        }
    }

    public BigDecimal getCostBasis() {
        return costBasis;
    }

    public void setCostBasis(BigDecimal costBasis) {
        this.costBasis = costBasis;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public void buy(BigDecimal qty, BigDecimal price) {
        quantity = quantity.add(qty);
        costBasis = costBasis.add(qty.multiply(price)).setScale(2, RoundingMode.HALF_UP);
        updatedAt = OffsetDateTime.now();
    }

    public BigDecimal sell(BigDecimal qty, BigDecimal price) {
        if (qty.compareTo(quantity) > 0) {
            throw new IllegalArgumentException("Cannot sell " + qty + " " + instrument.getSymbol() + "; only " + quantity + " held");
        }

        BigDecimal soldFraction = qty.divide(quantity, 10, RoundingMode.HALF_UP);
        BigDecimal basisSold = costBasis.multiply(soldFraction).setScale(2, RoundingMode.HALF_UP);
        BigDecimal proceeds = qty.multiply(price).setScale(2, RoundingMode.HALF_UP);

        quantity = quantity.subtract(qty);
        costBasis = costBasis.subtract(basisSold);
        updatedAt = OffsetDateTime.now();

        return proceeds.subtract(basisSold);
    }

    public BigDecimal marketValue(BigDecimal price) {
        return quantity.multiply(price).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal unrealizedPnL(BigDecimal price) {
        return marketValue(price).subtract(costBasis);
    }

    public BigDecimal avgCost() {
        if (isEmpty()) {
            return BigDecimal.ZERO.setScale(2);
        }
        return costBasis.divide(quantity, 2, RoundingMode.HALF_UP);
    }

    public boolean isEmpty() {
        return quantity.signum() == 0;
    }

    @Override
    public String toString() {
        return "Holding{holdingId=" + holdingId + ", accountId=" + accountId + ", symbol=" + (instrument == null ? null : instrument.getSymbol()) + ", costBasis=" + costBasis + "}";
    }
}