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
        this.price = MarketService.getPrice();
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

    public void setStatus(String status) {
        switch(status) {
            case "COMPLETE":
                // Orders loaded from the DB already carry their real fulfilled time.
                if (fulfilledTime == null) {
                    fulfilledTime = Instant.now();
                }
            case "PENDING":
            case "FAILED":
                this.status = status;
                break;
        }
    }
}
