package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One recorded price for an instrument (a row of instrument_price), in USD.
 */
public class PricePoint {
    private Instant observedAt;
    private BigDecimal price;

    public Instant getObservedAt() {
        return observedAt;
    }

    public void setObservedAt(Instant observedAt) {
        this.observedAt = observedAt;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }
}
