package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.WatchlistRequest;
import com.neueda.leap.controllers.dto.WatchlistResponse;
import com.neueda.leap.security.AccessControl;
import com.neueda.leap.services.WatchlistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/**
 * REST API Controller for an account's watchlist (starred instruments)
 */
@RestController
@RequestMapping("/accounts/{accountId}/watchlist")
@CrossOrigin(origins = "*")
@Tag(name = "Watchlist", description = "Watchlist endpoints")
public class WatchlistController {

    private final WatchlistService watchlistService;
    private final AccessControl access;

    public WatchlistController(WatchlistService watchlistService, AccessControl access) {
        this.watchlistService = watchlistService;
        this.access = access;
    }

    /**
     * GET /api/accounts/{accountId}/watchlist
     */
    @GetMapping
    @Operation(summary = "Get the watchlist", description = "Returns the account's starred instrument ids, in display order")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Watchlist retrieved (empty list if nothing is starred)"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public WatchlistResponse getWatchlist(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId) {
        access.assertCanReadAccount(accountId);
        return new WatchlistResponse(accountId, watchlistService.findInstrumentIds(accountId));
    }

    /**
     * PUT /api/accounts/{accountId}/watchlist
     */
    @PutMapping
    @Operation(summary = "Replace the watchlist",
            description = "Saves the whole watchlist in the order given. Starring, unstarring and reordering are all this one call.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Watchlist saved; the response is what is now stored"),
        @ApiResponse(responseCode = "400", description = "instrumentIds missing, or an instrument listed twice"),
        @ApiResponse(responseCode = "404", description = "Account or instrument not found")
    })
    public WatchlistResponse replaceWatchlist(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @Valid @RequestBody WatchlistRequest request) {
        access.assertCanTrade(accountId);
        return new WatchlistResponse(accountId, watchlistService.replace(accountId, request.instrumentIds()));
    }
}
