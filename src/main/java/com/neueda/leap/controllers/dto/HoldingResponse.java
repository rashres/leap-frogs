package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.Holding;
import com.neueda.leap.services.domain.Instrument;

import java.math.BigDecimal;

public record HoldingResponse(
        int instrumentId,
        String symbol,
        String instrumentName,
        BigDecimal quantity,
        BigDecimal currentPrice,
        BigDecimal marketValue
) {
    public static HoldingResponse from(Holding holding) {
        Instrument instrument = holding.getInstrument();
        BigDecimal price = instrument.getPrice();
        return new HoldingResponse(
                instrument.getStockId(),
                instrument.getSymbol(),
                instrument.getName(),
                holding.getQuantity(),
                price,
                holding.marketValue(price));
    }
}
