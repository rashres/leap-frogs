package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.CopySettings;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request DTO for starting to copy a lead trader. The follower comes from the URL.
 */
@Schema(description = "Start copying a lead trader")
public record CopySubscriptionRequest(
        @NotNull(message = "copyTraderId is required")
        @Schema(description = "The lead trader to copy", example = "1")
        Integer copyTraderId,

        @NotNull(message = "allocation is required")
        @Positive(message = "allocation must be greater than 0")
        @Schema(description = "USD budget for this copy; each copied buy is scaled by allocation / trader equity, "
                + "and buys stop once the copy's positions (at cost) reach it", example = "12500")
        BigDecimal allocation,

        @Positive(message = "maxPerTrade must be greater than 0")
        @Schema(description = "Most a single copied buy may cost, in USD; omit for no cap", example = "1000")
        BigDecimal maxPerTrade,

        @Positive(message = "stopLossPercent must be greater than 0")
        @DecimalMax(value = "100", message = "stopLossPercent must be at most 100")
        @Schema(description = "Pause copying once the copy has lost this percent of its allocation; omit for none", example = "20")
        BigDecimal stopLossPercent,

        @Schema(description = "Also sell the copy's shares when the stop-loss pauses it", example = "false")
        Boolean sellOnStopLoss
) {
    public CopySettings settings() {
        return new CopySettings(allocation, maxPerTrade, stopLossPercent, Boolean.TRUE.equals(sellOnStopLoss), false);
    }
}
