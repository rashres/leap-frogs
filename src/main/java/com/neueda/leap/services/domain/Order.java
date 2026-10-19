package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

public class Order {
    private int orderId;
    private Account account;
    private Instrument instrument;
    private String side;
    private BigDecimal quantity;
    private BigDecimal price;
    private String status;
    private Instant placedTime;
    private Instant fulfilledTime;
    private BigDecimal balanceUpdatedTo;
    // MARKET fills at the market price; LIMIT only at limitPrice or better.
    private String orderType = "MARKET";
    private BigDecimal limitPrice;
    // DAY expires at expiresAt (the close of its session); GTC waits until filled or cancelled.
    private String timeInForce = "DAY";
    private Instant expiresAt;

    // Used by MyBatis when reading orders back from the transactions table.
    public Order() {
    }

    /**
     * Creates an order
     *
     * @param account the account that is making the order
     * @param instrument the instrument being traded
     * @param side the transaction type
     * @param quantity how many instruments are being traded
     */
    public Order(Account account, Instrument instrument, String side, BigDecimal quantity) {
        placedTime = Instant.now();
        this.account = account;
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
        // Price is taken from the instrument at the moment the order is created,
        // so the order keeps the price it was agreed at even if the market moves.
        // Null means no price has been fetched yet; OrderValidator rejects that.
        this.price = instrument != null ? instrument.getPrice() : null;
        this.status = "CREATED";
    }

    public int getOrderId() {
        return orderId;
    }

    public void setOrderId(int orderId) {
        this.orderId = orderId;
    }

    public Account getAccount() {
        return account;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public String getSide() {
        return side;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public BigDecimal getValue() {
        return quantity.multiply(price);
    }

    public String getStatus() {
        return status;
    }

    public Instant getPlacedTime() {
        return placedTime;
    }

    public Instant getFulfilledTime() {
        return fulfilledTime;
    }

    /** When the order changed cash and holdings: its fill time, or for older rows its placed time. */
    public Instant getEffectiveTime() {
        return fulfilledTime != null ? fulfilledTime : placedTime;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public BigDecimal getLimitPrice() {
        return limitPrice;
    }

    public void setLimitPrice(BigDecimal limitPrice) {
        this.limitPrice = limitPrice;
    }

    public String getTimeInForce() {
        return timeInForce;
    }

    public void setTimeInForce(String timeInForce) {
        this.timeInForce = timeInForce;
    }

    public BigDecimal getBalanceUpdatedTo() {
        return balanceUpdatedTo;
    }

    public void setBalanceUpdatedTo(BigDecimal balanceUpdatedTo) {
        this.balanceUpdatedTo = balanceUpdatedTo;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isLimit() {
        return "LIMIT".equals(orderType);
    }

    public boolean isBuy() {
        return "BUY".equals(side);
    }

    /**
     * The most this order can cost (BUY) while it waits: a limit order never
     * fills above its limit; a market order is reserved at the price it was
     * placed at, and is rejected at the fill if the market has since risen past
     * what the account can pay.
     */
    public BigDecimal getReservedValue() {
        return quantity.multiply(isLimit() ? limitPrice : price);
    }

    /**
     * Whether the order may fill at `marketPrice`: a market order always can;
     * a limit buy only at or below its limit, a limit sell at or above it.
     */
    public boolean canFillAt(BigDecimal marketPrice) {
        if (marketPrice == null) {
            return false;
        }
        if (!isLimit()) {
            return true;
        }
        int cmp = marketPrice.compareTo(limitPrice);
        return isBuy() ? cmp <= 0 : cmp >= 0;
    }

    /** Fills the order at `fillPrice`, at time `at`. */
    public void fill(BigDecimal fillPrice, Instant at) {
        this.price = fillPrice;
        this.fulfilledTime = at;
        setStatus("COMPLETE");
    }

    public void setStatus(String status) {
        switch(status) {
            case "COMPLETE":
                // Orders loaded from the DB already carry their real fulfilled time.
                if (fulfilledTime == null) {
                    fulfilledTime = Instant.now();
                }
            case "PENDING":
            case "FAILED":
            case "CANCELLED":
            case "EXPIRED":
                this.status = status;
                break;
        }
    }
}
