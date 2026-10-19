package com.neueda.leap.services.domain;

/** Links a follower's order to the lead trader's order it copied (null for a stop-loss sell). */
public class CopiedOrder {
    private int orderId;
    private Integer leaderOrderId;
    private int copyTraderId;
    private String traderName;
    private String traderHandle;

    public int getOrderId() {
        return orderId;
    }

    public void setOrderId(int orderId) {
        this.orderId = orderId;
    }

    public Integer getLeaderOrderId() {
        return leaderOrderId;
    }

    public void setLeaderOrderId(Integer leaderOrderId) {
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
