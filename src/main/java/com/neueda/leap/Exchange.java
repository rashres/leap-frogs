package com.neueda.leap;

public class Exchange {
    private int exchange_id;
    private String exchangeName;
    private String country;
    

    public void setExchangeId(int exchange_id) {
        this.exchange_id = exchange_id;
    }
    

    public int getExchangeId() {
        
        return this.exchange_id;
}


    public void setName(String exchangeName){
        this.exchangeName = exchangeName;
    }

    public String getName(){
        return this.exchangeName;
    }

    public void setCountry(String country) {
        this.country = country;

    }

    public String getCountry() {
        return this.country;
    }
}
