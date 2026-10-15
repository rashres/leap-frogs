package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.CopyTraderSummary;
import com.neueda.leap.services.domain.CopyTrader;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Schema(description = "A lead trader other accounts can copy, with their performance")
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

        @Schema(description = "Capital the trader started with, in USD", example = "100000.00")
        BigDecimal startingCapital,

        @Schema(description = "Cash plus holdings at the latest prices, in USD", example = "124310.55")
        BigDecimal equity,

        @Schema(description = "Equity against starting capital, in percent", example = "24.31")
        BigDecimal returnPercent,

        @Schema(description = "Percent of closing sells made above the average buy price; null before the first sell", example = "68.4")
        BigDecimal winRate,

        @Schema(description = "Sells that closed some or all of a position", example = "19")
        int closedTrades,

        @Schema(description = "Filled orders", example = "52")
        int totalTrades,

        @Schema(description = "Accounts copying the trader now", example = "3")
        int followers,

        @Schema(description = "When the trader started trading on the platform")
        Instant tradingSince
) {
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
                summary.returnPercent(),
                summary.winRate(),
                summary.closedTrades(),
                summary.totalTrades(),
                trader.getFollowers(),
                trader.getCreatedAt());
    }
}
