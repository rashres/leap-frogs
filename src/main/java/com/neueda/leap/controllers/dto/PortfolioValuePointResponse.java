package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.PortfolioValuePoint;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

@Schema(description = "An account's value at one moment, in USD")
public record PortfolioValuePointResponse(
        @Schema(description = "The moment this value is for")
        Instant at,

        @Schema(description = "Cash plus holdings value", example = "12500.00")
        BigDecimal totalValue,

        @Schema(description = "Cash balance at that moment", example = "10000.00")
        BigDecimal cash,

        @Schema(description = "Holdings valued at the prices recorded at that moment", example = "2500.00")
        BigDecimal holdingsValue
) {
    public static PortfolioValuePointResponse from(PortfolioValuePoint point) {
        return new PortfolioValuePointResponse(point.at(), point.totalValue(), point.cash(), point.holdingsValue());
    }
}
