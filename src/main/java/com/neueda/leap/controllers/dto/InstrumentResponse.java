package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Instrument;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tradable instrument (stock or crypto) and the market it trades on")
public record InstrumentResponse(
        @Schema(description = "The unique identifier of the instrument", example = "1")
        int instrumentId,

        @Schema(description = "Ticker symbol", example = "AAPL")
        String symbol,

        @Schema(description = "Instrument name", example = "Apple Inc.")
        String name,

        @Schema(description = "Exchange (market) the instrument trades on", example = "NASDAQ")
        String exchange,

        @Schema(description = "Country of the exchange", example = "USA")
        String country
) {
    public static InstrumentResponse from(Instrument instrument) {
        return new InstrumentResponse(
                instrument.getInstrumentId(),
                instrument.getSymbol(),
                instrument.getName(),
                instrument.getExchange().getName(),
                instrument.getExchange().getCountry());
    }
}
