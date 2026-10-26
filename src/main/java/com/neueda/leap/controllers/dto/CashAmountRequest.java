package com.neueda.leap.controllers.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

/** Cash to add to or take out of an account, in USD. */
public record CashAmountRequest(
        @NotNull(message = "amount is required")
        @DecimalMin(value = "0.01", message = "amount must be at least 0.01")
        @DecimalMax(value = "1000000", message = "amount must be at most 1,000,000")
        @Digits(integer = 7, fraction = 2, message = "amount can have at most 2 decimal places")
        BigDecimal amount
) {}
