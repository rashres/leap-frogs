package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.CopyTraderSummary;
import com.neueda.leap.services.domain.CopyTrader;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Schema(description = "A lead trader other accounts can copy, with their performance. Money is in USD.")
public record CopyTraderResponse(
        @Schema(description = "The unique identifier of the lead trader", example = "1")
        int copyTraderId,

        @Schema(description = "The account the trader places orders from", example = "17")
        int accountId,

        @Schema(description = "Display name", example = "Marcus Hale")
        String name,

        @Schema(description = "Public handle", example = "@hale_growth")
        String handle,

        @Schema(description = "Short strategy label", example = "US Tech Growth")
        String strategy,

        @Schema(description = "Markets the trader trades", example = "[\"US\"]")
        List<String> markets,

        @Schema(description = "A few lines about how the trader invests")
        String bio,

        @Schema(description = "LOW, MEDIUM or HIGH", example = "MEDIUM")
        String riskLevel,

        @Schema(description = "Capital the trader started with", example = "100000.00")
        BigDecimal startingCapital,

        @Schema(description = "Cash plus holdings at the latest prices", example = "113101.55")
        BigDecimal equity,

        @Schema(description = "Profit and loss: equity minus starting capital", example = "13101.55")
        BigDecimal pnl,

        @Schema(description = "Return on investment: pnl against starting capital, in percent", example = "13.10")
        BigDecimal roi,

        @Schema(description = "Maximum drawdown: largest fall from a peak of the daily equity curve, in percent", example = "6.42")
        BigDecimal maxDrawdown,

        @Schema(description = "Annualised Sharpe ratio of daily returns (risk-free rate 0); null with under 20 days of history", example = "1.84")
        BigDecimal sharpeRatio,

        @Schema(description = "Assets under management: the trader's equity plus what copiers have allocated", example = "125601.55")
        BigDecimal aum,

        @Schema(description = "What copiers have allocated to this trader", example = "12500.00")
        BigDecimal copierFunds,

        @Schema(description = "Percent of closing sells made above the average buy price; null before the first sell", example = "71.4")
        BigDecimal successRate,

        @Schema(description = "Sells that closed some or all of a position", example = "7")
        int closedTrades,

        @Schema(description = "Filled orders", example = "20")
        int totalTrades,

        @Schema(description = "Accounts copying the trader now", example = "3")
        int copiers,

        @Schema(description = "When the trader started trading on the platform")
        Instant tradingSince,

        @Schema(description = "Daily equity since the trader started, oldest first, ending at today's equity")
        List<EquityPoint> equityCurve
) {
    @Schema(description = "The trader's equity at one moment")
    public record EquityPoint(Instant at, BigDecimal equity) {
    }

    public static CopyTraderResponse from(CopyTraderSummary summary) {
        CopyTrader trader = summary.trader();
        List<String> markets = trader.getMarkets() == null ? List.of()
                : Arrays.stream(trader.getMarkets().split(",")).map(String::trim).filter(m -> !m.isEmpty()).toList();
        return new CopyTraderResponse(
                trader.getCopyTraderId(),
                trader.getAccountId(),
                trader.getName(),
                trader.getHandle(),
                trader.getStrategy(),
                markets,
                trader.getBio(),
                trader.getRiskLevel(),
                trader.getStartingCapital(),
                trader.getEquity(),
                summary.pnl(),
                summary.roi(),
                summary.maxDrawdown(),
                summary.sharpeRatio(),
                summary.aum(),
                trader.getCopierFunds(),
                summary.successRate(),
                summary.closedTrades(),
                summary.totalTrades(),
                trader.getFollowers(),
                trader.getCreatedAt(),
                summary.equityCurve().stream().map(p -> new EquityPoint(p.at(), p.totalValue())).toList());
    }
}
