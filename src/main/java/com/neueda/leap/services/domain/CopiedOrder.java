package com.neueda.leap.services.domain;

/** Links a follower's order to the lead trader's order it copied. */
public class CopiedOrder {
    private int orderId;
    private int leaderOrderId;
    private int copyTraderId;
    private String traderName;
    private String traderHandle;

    public int getOrderId() {
        return orderId;
    }

    public void setOrderId(int orderId) {
        this.orderId = orderId;
    }

    public int getLeaderOrderId() {
        return leaderOrderId;
    }

    public void setLeaderOrderId(int leaderOrderId) {
        this.leaderOrderId = leaderOrderId;
    }

    public int getCopyTraderId() {
        return copyTraderId;
    }

    public void setCopyTraderId(int copyTraderId) {
        this.copyTraderId = copyTraderId;
    }

    public String getTraderName() {
        return traderName;
    }

    public void setTraderName(String traderName) {
        this.traderName = traderName;
    }

    public String getTraderHandle() {
        return traderHandle;
    }

    public void setTraderHandle(String traderHandle) {
        this.traderHandle = traderHandle;
    }
}
