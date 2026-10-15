package com.neueda.leap.services;

import com.neueda.leap.services.domain.CopyTrader;

import java.math.BigDecimal;

/**
 * A lead trader with the numbers the leaderboard shows.
 *
 * @param returnPercent equity against starting capital, in percent
 * @param winRate       percent of closing sells made above the average buy price; null before the first sell
 * @param closedTrades  sells that closed some or all of a position
 * @param totalTrades   filled orders
 */
public record CopyTraderSummary(CopyTrader trader, BigDecimal returnPercent, BigDecimal winRate,
                                int closedTrades, int totalTrades) {
}
