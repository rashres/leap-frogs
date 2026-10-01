package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Request DTO for creating or updating an account
 */
@Schema(description = "Request to create or update an account")
public record AccountRequest(
        @NotBlank @Size(max = 100)
        @Schema(description = "Account holder's name", example = "John Doe", maxLength = 100, requiredMode = Schema.RequiredMode.REQUIRED)
        String name,

        @NotBlank @Email @Size(max = 255)
        @Schema(description = "Account holder's email address", example = "john.doe@example.com", maxLength = 255, requiredMode = Schema.RequiredMode.REQUIRED)
        String email,

        @NotNull @PositiveOrZero
        @Schema(description = "Opening cash balance of the account, zero or greater", example = "50000.00", minimum = "0", requiredMode = Schema.RequiredMode.REQUIRED)
        BigDecimal cashBalance
) {
}
