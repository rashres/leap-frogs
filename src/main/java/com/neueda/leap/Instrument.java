package com.neueda.leap;

public class Instrument {

    private int stockId;
    private String symbol;
    private String name;
    private int exchangeId;

    public Instrument(){

    }

    public Instrument(int stockId, String symbol, String name, int exchangeId){
        this.stockId = stockId;
        this.symbol = symbol;
        this.name = name;
        this.exchangeId = exchangeId;

    }

    public int getStockId(){
        return stockId;
    }

    public void setStockId(int stockId){
        this.stockId = stockId;
    }
    public String getSymbol(){
        return symbol;
    }
    public void setSymbol(String symbol){
        this.symbol = symbol;
    }
    public String getName(){
        return name;
    }
    public void setName(String name){
        this.name = name;
    }
    public int getExchangeId(){
        return exchangeId;
    }
    public void setExchangeId(int exchangeId){
        this.exchangeId = exchangeId;
    }

    public String displayName() {
        return symbol + " - " + name;
    }
    @Override
    public String toString() {
        return "Instrument{stockId = " + stockId + ", symbol = " + symbol + ", name = " + name +", exchangeId = " + exchangeId + "}";
    }
    
}
