package com.neueda.leap;

import java.math.BigDecimal;
import java.time.Instant;

public class Order {
    int order_id;
    Account account;
    Instrument instrument;
    String side;
    int quantity;
    BigDecimal price;
    String status;
    Instant placed_time;
    Instant fulfilled_time;

    /**
     * Creates an order
     *
     * @param account the account that is making the order
     * @param instrument the instrument being traded
     * @param side the transaction type
     * @param quantity how many instruments are being traded
     */
    public Order(Account account, Instrument instrument, String side, int quantity) {
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
        return Instrument;
    }

    public String getSide() {
        return side;
    }

    public int getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public String getStatus() {
        return status;
    }

    public void setOrderPending() {
        status = "PENDING";
    }

    public void setOrderFulfilled() {
        fulfilled_time = Instant.now();
        status = "FULFILLED";
    }

    public void setOrderFailed() {
        status = "FAILED";
    }

}
