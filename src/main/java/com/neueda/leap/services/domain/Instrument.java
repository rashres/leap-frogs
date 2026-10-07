package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

public class Instrument {

    private int instrumentId;
    private String symbol;
    private String name;
    private int exchangeId;
    private Exchange exchange;
    // Latest market price, loaded from instrument.last_price. Refreshed out of
    // band by etl/price_fetcher.py, so it is null until that has run once.
    private BigDecimal lastPrice;
    private Instant priceUpdatedAt;

    public Instrument(){

    }

    public Instrument(int instrumentId, String symbol, String name, int exchangeId){
        this.instrumentId = instrumentId;
        this.symbol = symbol;
        this.name = name;
        this.exchangeId = exchangeId;

    }

    public int getInstrumentId(){
        return instrumentId;
    }

    public void setInstrumentId(int instrumentId){
        if (instrumentId <= 0) {
            throw new IllegalArgumentException("Instrument ID must be positive");
        }
        this.instrumentId = instrumentId;
    }
    
    public String getSymbol(){
        return symbol;
    }
    
    public void setSymbol(String symbol){
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new IllegalArgumentException("Symbol cannot be null or empty");
        }
        this.symbol = symbol;
    }
    
    public String getName(){
        return name;
    }
    
    public void setName(String name){
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name cannot be null or empty");
        }
        this.name = name;
    }
    
    public int getExchangeId(){
        return exchangeId;
    }
    
    public void setExchangeId(int exchangeId){
        if (exchangeId <= 0) {
            throw new IllegalArgumentException("Exchange ID must be positive");
        }
        this.exchangeId = exchangeId;
    }

    public Exchange getExchange() {
        return exchange;
    }

    public void setExchange(Exchange exchange) {
        this.exchange = exchange;
    }

    public String displayName() {
        return symbol + " - " + name;
    }

    /**
     * Latest known market price, or null if no price has been fetched yet.
     * Callers that need a tradeable price should treat null as "cannot price".
     */
    public BigDecimal getPrice() {
        return lastPrice;
    }

    public BigDecimal getLastPrice() {
        return lastPrice;
    }

    public void setLastPrice(BigDecimal lastPrice) {
        if (lastPrice != null && lastPrice.signum() <= 0) {
            throw new IllegalArgumentException("Price must be positive");
        }
        this.lastPrice = lastPrice;
    }

    public Instant getPriceUpdatedAt() {
        return priceUpdatedAt;
    }

    public void setPriceUpdatedAt(Instant priceUpdatedAt) {
        this.priceUpdatedAt = priceUpdatedAt;
    }
    
    @Override
    public String toString() {
        return "Instrument{instrumentId=" + instrumentId + ", symbol=" + symbol + ", name=" + name + ", exchangeId=" + exchangeId + "}";
    }
    
    
    @Override
    public int hashCode() {
        return Objects.hash(instrumentId, symbol, name, exchangeId);
    }
}