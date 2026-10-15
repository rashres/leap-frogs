package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.domain.CopiedOrder;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "An order that was copied from a lead trader")
public record CopiedOrderResponse(
        @Schema(description = "The follower's order", example = "812")
        int orderId,

        @Schema(description = "The lead trader's order it copied", example = "809")
        int leaderOrderId,

        @Schema(description = "The lead trader", example = "1")
        int copyTraderId,

        @Schema(description = "The lead trader's name", example = "Marcus Hale")
        String traderName,

        @Schema(description = "The lead trader's handle", example = "@hale_growth")
        String traderHandle
) {
    public static CopiedOrderResponse from(CopiedOrder copied) {
        return new CopiedOrderResponse(
                copied.getOrderId(),
                copied.getLeaderOrderId(),
                copied.getCopyTraderId(),
                copied.getTraderName(),
                copied.getTraderHandle());
    }
}
