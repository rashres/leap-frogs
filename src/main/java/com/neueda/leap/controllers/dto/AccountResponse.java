package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Account;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Account information response")
public record AccountResponse(
        @Schema(description = "The unique identifier of the account", example = "1001")
        int accountId,
        
        @Schema(description = "Account holder's name", example = "John Doe")
        String name,
        
        @Schema(description = "Account holder's email address", example = "john.doe@example.com")
        String email,
        
        @Schema(description = "Current cash balance in the account", example = "50000.00")
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
