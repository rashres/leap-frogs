package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Account;

import java.math.BigDecimal;

public record AccountResponse(
        int accountId,
        String name,
        String email,
        BigDecimal cashBalance
) {
    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getAccountId(),
                account.getName(),
                account.getEmail(),
                account.getCashBalance());
    }
}
