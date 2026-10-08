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

        @Schema(description = "Exchange (market) the instrument trades on", example = "NASDAQ")
        String exchange,

        @Schema(description = "Country of the exchange", example = "USA")
        String country,
        
        @Schema(description = "Number of shares held", example = "50")
        BigDecimal quantity
) {
    public static HoldingResponse from(Holding holding) {
        Instrument instrument = holding.getInstrument();
        return new HoldingResponse(
                instrument.getInstrumentId(),
                instrument.getSymbol(),
                instrument.getName(),
                instrument.getExchange().getName(),
                instrument.getExchange().getCountry(),
                holding.getQuantity());
    }
}
