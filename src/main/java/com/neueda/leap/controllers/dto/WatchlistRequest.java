package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Request DTO for replacing an account's watchlist. The account comes from the URL.
 */
@Schema(description = "The whole watchlist, in display order")
public record WatchlistRequest(
        @NotNull(message = "instrumentIds is required (use [] to clear the list)")
        @Schema(description = "Starred instrument ids, first shown first", example = "[1, 3, 5]")
        List<@NotNull Integer> instrumentIds
) {
}
