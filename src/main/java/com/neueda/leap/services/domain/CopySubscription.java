package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An account copying a lead trader. Each new trade the leader places is copied
 * at allocation / leader equity of its size. Stopped subscriptions keep their
 * row (stoppedAt set) so earlier copied orders still say where they came from.
 */
public class CopySubscription {
    private int subscriptionId;
    private int followerAccountId;
    private int copyTraderId;
    private String traderName;
    private String traderHandle;
    private BigDecimal allocation;
    private Instant startedAt;
    private Instant stoppedAt;
    private int copiedOrders;

    public CopySubscription() {
    }

    public CopySubscription(int followerAccountId, int copyTraderId, BigDecimal allocation, Instant startedAt) {
        this.followerAccountId = followerAccountId;
        this.copyTraderId = copyTraderId;
        this.allocation = allocation;
        this.startedAt = startedAt;
    }

    public int getSubscriptionId() {
        return subscriptionId;
    }

    public void setSubscriptionId(int subscriptionId) {
        this.subscriptionId = subscriptionId;
    }

    public int getFollowerAccountId() {
        return followerAccountId;
    }

    public void setFollowerAccountId(int followerAccountId) {
        this.followerAccountId = followerAccountId;
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

    public BigDecimal getAllocation() {
        return allocation;
    }

    public void setAllocation(BigDecimal allocation) {
        this.allocation = allocation;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getStoppedAt() {
        return stoppedAt;
    }

    public void setStoppedAt(Instant stoppedAt) {
        this.stoppedAt = stoppedAt;
    }

    public int getCopiedOrders() {
        return copiedOrders;
    }

    public void setCopiedOrders(int copiedOrders) {
        this.copiedOrders = copiedOrders;
    }
}
