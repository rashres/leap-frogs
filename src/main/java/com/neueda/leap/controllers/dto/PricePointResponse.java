package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.PricePoint;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

@Schema(description = "A recorded price for an instrument, in USD")
public record PricePointResponse(
        @Schema(description = "When the price was observed")
        Instant observedAt,

        @Schema(description = "Price in USD", example = "150.50")
        BigDecimal price
) {
    public static PricePointResponse from(PricePoint point) {
        return new PricePointResponse(point.getObservedAt(), point.getPrice());
    }
}
