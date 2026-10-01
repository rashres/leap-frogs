package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.util.Objects;

public class Instrument {

    private int instrumentId;
    private String symbol;
    private String name;
    private int exchangeId;

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

    public String displayName() {
        return symbol + " - " + name;
    }

    public BigDecimal getPrice() {
        return MarketService.getPrice();
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