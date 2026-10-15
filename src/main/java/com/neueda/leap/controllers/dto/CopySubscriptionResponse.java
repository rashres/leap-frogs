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

        @Schema(description = "USD set aside for this trader", example = "12500.00")
        BigDecimal allocation,

        @Schema(description = "When copying started")
        Instant startedAt,

        @Schema(description = "Orders copied so far", example = "14")
        int copiedOrders
) {
    public static CopySubscriptionResponse from(CopySubscription subscription) {
        return new CopySubscriptionResponse(
                subscription.getSubscriptionId(),
                subscription.getFollowerAccountId(),
                subscription.getCopyTraderId(),
                subscription.getTraderName(),
                subscription.getTraderHandle(),
                subscription.getAllocation(),
                subscription.getStartedAt(),
                subscription.getCopiedOrders());
    }
}
