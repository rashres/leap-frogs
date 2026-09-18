package com.neueda.leap;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class Holding {
    private int holdingId;
    private int accountId;
    private Instrument instrument;
    private BigDecimal quantity = BigDecimal.ZERO
    private BigDecimal costbasis = BigDecimal.ZERO.setScale(2);
    private OffsetDateTime updatedAt =  OffsetDateTime.now();

    public Holding()

    public Holding(int holdingId, int accountId, Instrument instrument, BigDecimal quantity){
        this.holdingId = holdingId;
        this.accountId = accountId;
        this.instrument = instrument;
        this.quantity = quantity;

    }

    public int hetHolding(){
        return holdingId;
    }
    public void setHoldingId(int holdingId){
        this.holdingId = holdingId;
    }
    public int getAccountId(){
        return accountId;
    }

    public void setAccountId(int AccountId){
        this.accountId = accountId;
    }

    public Instrument getInstrument(){
        return instrument;
    }
    public void setInstrument(int instrument){
        this.instrument = instrument;
    }
    public BigDecimal getQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public void setCostBasis(BigDecimal costbasis){
        this.costbasis = costbasis;
    }


    

    
}
