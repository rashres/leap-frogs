package com.neueda.leap.services;

import com.neueda.leap.services.domain.CopyTrader;
import com.neueda.leap.services.domain.PortfolioValuePoint;

import java.math.BigDecimal;
import java.util.List;

/**
 * A lead trader with the numbers the leaderboard and profile show. Money is in USD.
 *
 * @param pnl            equity minus starting capital
 * @param roi            pnl against starting capital, in percent
 * @param maxDrawdown    largest fall from a peak of the daily equity curve, in percent (0 or more)
 * @param sharpeRatio    annualised mean / standard deviation of daily returns, risk-free rate 0; null with too little history
 * @param aum            assets under management: the trader's equity plus what copiers have allocated
 * @param successRate    percent of closing sells made above the average buy price; null before the first sell
 * @param closedTrades   sells that closed some or all of a position
 * @param totalTrades    filled orders
 * @param equityCurve    daily equity since the trader started, oldest first, ending at today's equity
 */
public record CopyTraderSummary(CopyTrader trader, BigDecimal pnl, BigDecimal roi, BigDecimal maxDrawdown,
                                BigDecimal sharpeRatio, BigDecimal aum, BigDecimal successRate,
                                int closedTrades, int totalTrades, List<PortfolioValuePoint> equityCurve) {
}
