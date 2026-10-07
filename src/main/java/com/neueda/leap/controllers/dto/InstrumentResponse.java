package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Instrument;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

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
        String country,

        @Schema(description = "Latest market price, or null if no price has been fetched yet", example = "150.50")
        BigDecimal lastPrice,

        @Schema(description = "When the price was last refreshed, or null if never")
        Instant priceUpdatedAt
) {
    public static InstrumentResponse from(Instrument instrument) {
        return new InstrumentResponse(
                instrument.getInstrumentId(),
                instrument.getSymbol(),
                instrument.getName(),
                instrument.getExchange().getName(),
                instrument.getExchange().getCountry(),
                instrument.getLastPrice(),
                instrument.getPriceUpdatedAt());
    }
}
