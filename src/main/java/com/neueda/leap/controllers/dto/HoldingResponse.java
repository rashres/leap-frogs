package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Holding;
import com.neueda.leap.services.domain.Instrument;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Stock holding information for an account")
public record HoldingResponse(
        @Schema(description = "The instrument/stock ID", example = "1")
        int instrumentId,
        
        @Schema(description = "Stock ticker symbol", example = "AAPL")
        String symbol,
        
        @Schema(description = "Full name of the instrument", example = "Apple Inc.")
        String instrumentName,
        
        @Schema(description = "Number of shares held", example = "50")
        BigDecimal quantity,
        
        @Schema(description = "Current market price per share", example = "150.50")
        BigDecimal currentPrice,
        
        @Schema(description = "Total market value of the holding (quantity × currentPrice)", example = "7525.00")
        BigDecimal marketValue
) {
    public static HoldingResponse from(Holding holding) {
        Instrument instrument = holding.getInstrument();
        BigDecimal price = instrument.getPrice();
        return new HoldingResponse(
                instrument.getInstrumentId(),
                instrument.getSymbol(),
                instrument.getName(),
                holding.getQuantity(),
                price,
                holding.marketValue(price));
    }
}
