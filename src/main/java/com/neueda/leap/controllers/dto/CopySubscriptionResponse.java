package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.CopySubscription;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

@Schema(description = "An account copying a lead trader")
public record CopySubscriptionResponse(
        @Schema(description = "The unique identifier of the subscription", example = "3")
        int subscriptionId,

        @Schema(description = "The account doing the copying", example = "23")
        int followerAccountId,

        @Schema(description = "The lead trader being copied", example = "1")
        int copyTraderId,

        @Schema(description = "The lead trader's name", example = "Marcus Hale")
        String traderName,

        @Schema(description = "The lead trader's handle", example = "@hale_growth")
        String traderHandle,

        @Schema(description = "USD budget for this copy", example = "12500.00")
        BigDecimal allocation,

        @Schema(description = "Most a single copied buy may cost; null for no cap", example = "1000.00")
        BigDecimal maxPerTrade,

        @Schema(description = "Loss, in percent of the allocation, that pauses the copy; null for none", example = "20.00")
        BigDecimal stopLossPercent,

        @Schema(description = "Whether the stop-loss also sells the copy's shares", example = "false")
        boolean sellOnStopLoss,

        @Schema(description = "Whether the copy is paused (buys not copied, sells still are)", example = "false")
        boolean paused,

        @Schema(description = "Why it is paused: USER or STOP_LOSS; null when not paused", example = "STOP_LOSS")
        String pauseReason,

        @Schema(description = "When it was paused; null when not paused")
        Instant pausedAt,

        @Schema(description = "When copying started")
        Instant startedAt,

        @Schema(description = "Orders copied so far", example = "14")
        int copiedOrders,

        @Schema(description = "What the copy's shares still held cost", example = "8200.00")
        BigDecimal invested,

        @Schema(description = "The copy's shares at the latest prices", example = "8650.00")
        BigDecimal marketValue,

        @Schema(description = "The copy's profit or loss so far, realized and unrealized", example = "512.40")
        BigDecimal pnl,

        @Schema(description = "Allocation not yet used by held or pending copied buys", example = "4300.00")
        BigDecimal budgetLeft
) {
    public static CopySubscriptionResponse from(CopySubscription subscription) {
        return new CopySubscriptionResponse(
                subscription.getSubscriptionId(),
                subscription.getFollowerAccountId(),
                subscription.getCopyTraderId(),
                subscription.getTraderName(),
                subscription.getTraderHandle(),
                subscription.getAllocation(),
                subscription.getMaxPerTrade(),
                subscription.getStopLossPercent(),
                subscription.isSellOnStopLoss(),
                subscription.isPaused(),
                subscription.getPauseReason(),
                subscription.getPausedAt(),
                subscription.getStartedAt(),
                subscription.getCopiedOrders(),
                subscription.getInvested(),
                subscription.getMarketValue(),
                subscription.getPnl(),
                subscription.getBudgetLeft());
    }
}
