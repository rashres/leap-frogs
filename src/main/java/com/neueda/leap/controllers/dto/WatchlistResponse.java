package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "An account's starred instruments")
public record WatchlistResponse(
        @Schema(description = "The account the watchlist belongs to", example = "1")
        int accountId,

        @Schema(description = "Starred instrument ids, in display order", example = "[1, 3, 5]")
        List<Integer> instrumentIds
) {
}
