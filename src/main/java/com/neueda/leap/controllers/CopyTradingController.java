package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.CopiedOrderResponse;
import com.neueda.leap.controllers.dto.CopySubscriptionRequest;
import com.neueda.leap.controllers.dto.CopySubscriptionResponse;
import com.neueda.leap.controllers.dto.CopyTraderResponse;
import com.neueda.leap.controllers.dto.OrderResponse;
import com.neueda.leap.security.AccessControl;
import com.neueda.leap.services.CopyTradingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Controller for copy trading: the lead traders, and the accounts copying them
 */
@RestController
@CrossOrigin(origins = "*")
@Tag(name = "Copy trading", description = "Lead traders and copy subscriptions")
public class CopyTradingController {

    private final CopyTradingService copyTradingService;
    private final AccessControl access;

    public CopyTradingController(CopyTradingService copyTradingService, AccessControl access) {
        this.copyTradingService = copyTradingService;
        this.access = access;
    }

    /**
     * GET /api/copy-traders
     */
    @GetMapping("/copy-traders")
    @Operation(summary = "List lead traders", description = "Every lead trader with their return, win rate and follower count")
    public List<CopyTraderResponse> listTraders() {
        return copyTradingService.findTraders().stream()
                .map(CopyTraderResponse::from)
                .toList();
    }

    /**
     * GET /api/copy-traders/{copyTraderId}
     */
    @GetMapping("/copy-traders/{copyTraderId}")
    @Operation(summary = "Get a lead trader")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lead trader found"),
        @ApiResponse(responseCode = "404", description = "Lead trader not found")
    })
    public CopyTraderResponse getTrader(
            @PathVariable @Parameter(description = "The unique identifier of the lead trader", example = "1") int copyTraderId) {
        return CopyTraderResponse.from(copyTradingService.findTrader(copyTraderId));
    }

    /**
     * GET /api/copy-traders/{copyTraderId}/orders
     */
    @GetMapping("/copy-traders/{copyTraderId}/orders")
    @Operation(summary = "List a lead trader's trades", description = "Every filled order of the trader, newest first")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Trades retrieved (empty list if none)"),
        @ApiResponse(responseCode = "404", description = "Lead trader not found")
    })
    public List<OrderResponse> listTraderOrders(
            @PathVariable @Parameter(description = "The unique identifier of the lead trader", example = "1") int copyTraderId) {
        return copyTradingService.findTraderOrders(copyTraderId).stream()
                .map(OrderResponse::from)
                .toList();
    }

    /**
     * GET /api/accounts/{accountId}/copy-subscriptions
     */
    @GetMapping("/accounts/{accountId}/copy-subscriptions")
    @Operation(summary = "List the traders an account is copying")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Subscriptions retrieved (empty list if none)"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public List<CopySubscriptionResponse> listSubscriptions(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId) {
        access.assertCanReadAccount(accountId);
        return copyTradingService.findSubscriptions(accountId).stream()
                .map(CopySubscriptionResponse::from)
                .toList();
    }

    /**
     * POST /api/accounts/{accountId}/copy-subscriptions
     */
    @PostMapping("/accounts/{accountId}/copy-subscriptions")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Start copying a lead trader",
            description = "From now on every order the trader places is copied to this account, scaled by allocation / trader equity. "
                        + "Existing positions are not bought in.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Copying started"),
        @ApiResponse(responseCode = "400", description = "Invalid allocation, already copying this trader, or copying itself"),
        @ApiResponse(responseCode = "404", description = "Account or lead trader not found")
    })
    public CopySubscriptionResponse follow(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @Valid @RequestBody CopySubscriptionRequest request) {
        access.assertCanTrade(accountId);
        return CopySubscriptionResponse.from(copyTradingService.follow(accountId, request.copyTraderId(), request.allocation()));
    }

    /**
     * DELETE /api/accounts/{accountId}/copy-subscriptions/{subscriptionId}
     */
    @DeleteMapping("/accounts/{accountId}/copy-subscriptions/{subscriptionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Stop copying a lead trader", description = "Orders already copied stay as they are")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Copying stopped"),
        @ApiResponse(responseCode = "404", description = "Account not found, or no such active subscription")
    })
    public void unfollow(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @PathVariable @Parameter(description = "The subscription to stop", example = "3") int subscriptionId) {
        access.assertCanTrade(accountId);
        copyTradingService.unfollow(accountId, subscriptionId);
    }

    /**
     * GET /api/accounts/{accountId}/copied-orders
     */
    @GetMapping("/accounts/{accountId}/copied-orders")
    @Operation(summary = "List the account's copied orders",
            description = "Which of the account's orders were copied from a lead trader, and from whom")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Copied orders retrieved (empty list if none)"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public List<CopiedOrderResponse> listCopiedOrders(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId) {
        access.assertCanReadAccount(accountId);
        return copyTradingService.findCopiedOrders(accountId).stream()
                .map(CopiedOrderResponse::from)
                .toList();
    }
}
