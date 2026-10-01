package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Request DTO for submitting new orders
 */
@Schema(description = "Request to submit a new trading order")
public record OrderRequest(
        @NotNull(message = "Account ID is required")
        @Schema(description = "The ID of the account placing the order", example = "1001")
        Integer accountId,

        @NotNull(message = "Instrument ID is required")
        @Schema(description = "The ID of the instrument to trade", example = "1")
        Integer instrumentId,

        @NotNull(message = "Side is required")
        @Schema(description = "Trade direction - BUY or SELL", example = "BUY")
        String side,

        @NotNull(message = "Quantity is required")
        @Positive(message = "Quantity must be positive")
        @Schema(description = "Number of shares to trade", example = "10")
        String quantity
) {
}
