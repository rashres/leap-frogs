package com.neueda.leap.services.domain;

import java.math.BigDecimal;

/**
 * What a follower chooses for one copy.
 *
 * @param allocation      USD budget for the copy; copied buys stop once its positions (at cost) reach it
 * @param maxPerTrade     most a single copied buy may cost, or null for no cap
 * @param stopLossPercent pause the copy once it has lost this percent of its allocation, or null for none
 * @param sellOnStopLoss  also sell the copy's shares when the stop-loss pauses it
 * @param paused          while paused, the trader's buys are not copied; their sells still are
 */
public record CopySettings(BigDecimal allocation, BigDecimal maxPerTrade, BigDecimal stopLossPercent,
                           boolean sellOnStopLoss, boolean paused) {
}
