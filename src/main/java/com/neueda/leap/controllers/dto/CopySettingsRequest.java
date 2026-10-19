package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.CopySettings;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Request DTO for changing an active copy. Replaces all of its settings: an
 * omitted maxPerTrade or stopLossPercent clears it.
 */
@Schema(description = "A copy's settings, and whether it is paused")
public record CopySettingsRequest(
        @NotNull(message = "allocation is required")
        @Positive(message = "allocation must be greater than 0")
        @Schema(description = "USD budget for this copy", example = "12500")
        BigDecimal allocation,

        @Positive(message = "maxPerTrade must be greater than 0")
        @Schema(description = "Most a single copied buy may cost, in USD; omit for no cap", example = "1000")
        BigDecimal maxPerTrade,

        @Positive(message = "stopLossPercent must be greater than 0")
        @DecimalMax(value = "100", message = "stopLossPercent must be at most 100")
        @Schema(description = "Pause copying once the copy has lost this percent of its allocation; omit for none", example = "20")
        BigDecimal stopLossPercent,

        @Schema(description = "Also sell the copy's shares when the stop-loss pauses it", example = "false")
        Boolean sellOnStopLoss,

        @Schema(description = "Paused copies skip the trader's buys but still copy their sells", example = "false")
        Boolean paused
) {
    public CopySettings settings() {
        return new CopySettings(allocation, maxPerTrade, stopLossPercent, Boolean.TRUE.equals(sellOnStopLoss),
                Boolean.TRUE.equals(paused));
    }
}
