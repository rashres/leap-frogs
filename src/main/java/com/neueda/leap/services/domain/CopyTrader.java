package com.neueda.leap.services.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A lead trader other accounts can copy. Trades as an ordinary account
 * (accountId); the rest is the profile shown on the leaderboard.
 */
public class CopyTrader {
    private int copyTraderId;
    private int accountId;
    private String name;
    private String handle;
    private String strategy;
    // Comma separated market codes, e.g. "US,UK".
    private String markets;
    private String bio;
    // LOW, MEDIUM or HIGH.
    private String riskLevel;
    private BigDecimal startingCapital;
    private Instant createdAt;
    // Worked out by the query: cash plus holdings at last_price, and active followers.
    private BigDecimal equity;
    private int followers;

    public int getCopyTraderId() {
        return copyTraderId;
    }

    public void setCopyTraderId(int copyTraderId) {
        this.copyTraderId = copyTraderId;
    }

    public int getAccountId() {
        return accountId;
    }

    public void setAccountId(int accountId) {
        this.accountId = accountId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHandle() {
        return handle;
    }

    public void setHandle(String handle) {
        this.handle = handle;
    }

    public String getStrategy() {
        return strategy;
    }

    public void setStrategy(String strategy) {
        this.strategy = strategy;
    }

    public String getMarkets() {
        return markets;
    }

    public void setMarkets(String markets) {
        this.markets = markets;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public BigDecimal getStartingCapital() {
        return startingCapital;
    }

    public void setStartingCapital(BigDecimal startingCapital) {
        this.startingCapital = startingCapital;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public BigDecimal getEquity() {
        return equity;
    }

    public void setEquity(BigDecimal equity) {
        this.equity = equity;
    }

    public int getFollowers() {
        return followers;
    }

    public void setFollowers(int followers) {
        this.followers = followers;
    }
}
