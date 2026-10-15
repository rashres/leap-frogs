package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
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
        @Schema(description = "USD set aside for this trader; each copied buy is scaled by allocation / trader equity", example = "12500")
        BigDecimal allocation
) {
}
