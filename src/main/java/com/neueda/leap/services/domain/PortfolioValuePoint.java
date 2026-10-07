package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An account's value at one moment, in USD: cash plus holdings at that moment's prices.
 */
public record PortfolioValuePoint(Instant at, BigDecimal cash, BigDecimal holdingsValue) {

    public BigDecimal totalValue() {
        return cash.add(holdingsValue);
    }
}
