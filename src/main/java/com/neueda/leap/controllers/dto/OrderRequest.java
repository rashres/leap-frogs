package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request DTO for submitting new orders. The account comes from the URL.
 */
@Schema(description = "Request to submit a new trading order")
public record OrderRequest(
        @NotNull(message = "Instrument ID is required")
        @Schema(description = "The ID of the instrument to trade", example = "1")
        Integer instrumentId,

        @NotBlank(message = "Side is required")
        @Schema(description = "Trade direction - BUY or SELL (case-insensitive)", example = "BUY")
        String side,

        @NotNull(message = "Quantity is required")
        @Positive(message = "Quantity must be positive")
        @Schema(description = "Number of shares to trade", example = "10")
        BigDecimal quantity
) {
}
