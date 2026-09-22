package com.neueda.leap;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

public class Account {
    private int accountId;
    private String name;
    private String email;
    private BigDecimal cashBalance;
    private Map<Instrument, Holding> holdings;

    public Account(int accountId, String name, String email, BigDecimal cashBalance) {
        this.accountId = accountId;
        this.name = name;
        this.email = email;
        this.cashBalance = cashBalance;
        this.holdings = new HashMap<>();
    }

    public int getAccountId() {
        return accountId;
    }

    public void setAccountId(int accountId) {
        this.accountId = accountId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public BigDecimal getCashBalance() {
        return cashBalance;
    }

    public void setCashBalance(BigDecimal cashBalance) {
        this.cashBalance = cashBalance;
    }

    public Map<Instrument, Holding> getHoldings() {
        return holdings;
    }

    public Holding getHolding(Instrument instrument) {
        return holdings.get(instrument);
    }

    public void addHolding(Instrument instrument, Holding holding) {
        holdings.put(instrument, holding);
    }

    public void updateCashBalance(BigDecimal amount) {
        this.cashBalance = this.cashBalance.add(amount);
    }
}
