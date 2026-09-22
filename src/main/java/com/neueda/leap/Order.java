package com.neueda.leap;

import java.math.BigDecimal;
import java.time.Instant;

public class Order {
    private int order_id;
    private Account account;
    private Instrument instrument;
    private String side;
    private BigDecimal quantity;
    private BigDecimal price;
    private String status;
    private Instant placed_time;
    private Instant fulfilled_time;

    /**
     * Creates an order
     *
     * @param account the account that is making the order
     * @param instrument the instrument being traded
     * @param side the transaction type
     * @param quantity how many instruments are being traded
     */
    public Order(Account account, Instrument instrument, String side, BigDecimal quantity) {
        placed_time = Instant.now();
        this.account = account;
        this.instrument = instrument;
        this.side = side;
        this.quantity = quantity;
        this.price = MarketService.getPrice();
        this.status = "CREATED";
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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        switch(status) {
            case "COMPLETE":
                fulfilled_time = Instant.now();
            case "PENDING":
            case "FAILED":
                this.status = status;
                break;
        }
    }

}
