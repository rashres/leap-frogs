package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Cash added to an account (a row of cash_deposit), in USD.
 */
public class CashDeposit {
    private int depositId;
    private int accountId;
    private BigDecimal amount;
    private Instant depositedAt;

    public int getDepositId() {
        return depositId;
    }

    public void setDepositId(int depositId) {
        this.depositId = depositId;
    }

    public int getAccountId() {
        return accountId;
    }

    public void setAccountId(int accountId) {
        this.accountId = accountId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public Instant getDepositedAt() {
        return depositedAt;
    }

    public void setDepositedAt(Instant depositedAt) {
        this.depositedAt = depositedAt;
    }
}
