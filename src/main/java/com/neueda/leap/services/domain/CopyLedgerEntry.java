package com.neueda.leap.services.domain;

import java.math.BigDecimal;

/** One order a copy placed, as needed to work out what the copy holds (see CopyBook). */
public class CopyLedgerEntry {
    private int instrumentId;
    private String side;
    private String status;
    private BigDecimal quantity;
    /** The fill price once COMPLETE; the market price at placement while PENDING. */
    private BigDecimal price;
    private BigDecimal limitPrice;
    /** The instrument's latest price, for valuing what is still held. */
    private BigDecimal lastPrice;

    public CopyLedgerEntry() {
    }

    public CopyLedgerEntry(int instrumentId, String side, String status, BigDecimal quantity, BigDecimal price,
                           BigDecimal limitPrice, BigDecimal lastPrice) {
        this.instrumentId = instrumentId;
        this.side = side;
        this.status = status;
        this.quantity = quantity;
        this.price = price;
        this.limitPrice = limitPrice;
        this.lastPrice = lastPrice;
    }

    public boolean isBuy() {
        return "BUY".equals(side);
    }

    public int getInstrumentId() {
        return instrumentId;
    }

    public void setInstrumentId(int instrumentId) {
        this.instrumentId = instrumentId;
    }

    public String getSide() {
        return side;
    }

    public void setSide(String side) {
        this.side = side;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getLimitPrice() {
        return limitPrice;
    }

    public void setLimitPrice(BigDecimal limitPrice) {
        this.limitPrice = limitPrice;
    }

    public BigDecimal getLastPrice() {
        return lastPrice;
    }

    public void setLastPrice(BigDecimal lastPrice) {
        this.lastPrice = lastPrice;
    }
}
