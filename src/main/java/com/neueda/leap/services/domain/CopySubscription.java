package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An account copying a lead trader. Each new trade the leader places is copied
 * at allocation / leader equity of its size, within the copy's settings.
 * Stopped subscriptions keep their row (stoppedAt set) so earlier copied orders
 * still say where they came from.
 */
public class CopySubscription {
    private int subscriptionId;
    private int followerAccountId;
    private int copyTraderId;
    private String traderName;
    private String traderHandle;
    private BigDecimal allocation;
    private BigDecimal maxPerTrade;
    private BigDecimal stopLossPercent;
    private boolean sellOnStopLoss;
    private Instant pausedAt;
    /** USER or STOP_LOSS while paused, otherwise null. */
    private String pauseReason;
    private Instant startedAt;
    private Instant stoppedAt;
    private int copiedOrders;

    // Worked out from the copy's own orders (CopyBook); not stored.
    private BigDecimal invested;
    private BigDecimal marketValue;
    private BigDecimal pnl;
    private BigDecimal budgetLeft;

    public CopySubscription() {
    }

    public CopySubscription(int followerAccountId, int copyTraderId, CopySettings settings, Instant startedAt) {
        this.followerAccountId = followerAccountId;
        this.copyTraderId = copyTraderId;
        this.allocation = settings.allocation();
        this.maxPerTrade = settings.maxPerTrade();
        this.stopLossPercent = settings.stopLossPercent();
        this.sellOnStopLoss = settings.sellOnStopLoss();
        this.startedAt = startedAt;
    }

    public boolean isPaused() {
        return pausedAt != null;
    }

    public BigDecimal getMaxPerTrade() {
        return maxPerTrade;
    }

    public void setMaxPerTrade(BigDecimal maxPerTrade) {
        this.maxPerTrade = maxPerTrade;
    }

    public BigDecimal getStopLossPercent() {
        return stopLossPercent;
    }

    public void setStopLossPercent(BigDecimal stopLossPercent) {
        this.stopLossPercent = stopLossPercent;
    }

    public boolean isSellOnStopLoss() {
        return sellOnStopLoss;
    }

    public void setSellOnStopLoss(boolean sellOnStopLoss) {
        this.sellOnStopLoss = sellOnStopLoss;
    }

    public Instant getPausedAt() {
        return pausedAt;
    }

    public void setPausedAt(Instant pausedAt) {
        this.pausedAt = pausedAt;
    }

    public String getPauseReason() {
        return pauseReason;
    }

    public void setPauseReason(String pauseReason) {
        this.pauseReason = pauseReason;
    }

    public BigDecimal getInvested() {
        return invested;
    }

    public BigDecimal getMarketValue() {
        return marketValue;
    }

    public BigDecimal getPnl() {
        return pnl;
    }

    public BigDecimal getBudgetLeft() {
        return budgetLeft;
    }

    /** Fills in the copy's position and profit or loss from its book. */
    public void setPerformance(BigDecimal invested, BigDecimal marketValue, BigDecimal pnl, BigDecimal budgetLeft) {
        this.invested = invested;
        this.marketValue = marketValue;
        this.pnl = pnl;
        this.budgetLeft = budgetLeft;
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
