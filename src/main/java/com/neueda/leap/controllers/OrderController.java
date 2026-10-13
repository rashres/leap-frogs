package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.OrderRequest;
import com.neueda.leap.controllers.dto.OrderResponse;
import com.neueda.leap.services.OrderResult;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Controller for an account's orders (stored in the transactions table)
 */
@RestController
@RequestMapping("/accounts/{accountId}/orders")
@CrossOrigin(origins = "*")
@Tag(name = "Orders", description = "Order management endpoints")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /**
     * POST /api/accounts/{accountId}/orders
     */
    @PostMapping
    @Operation(summary = "Submit a new order",
            description = "Places a BUY or SELL order for the account, MARKET or LIMIT. It fills now when its market is open "
                        + "and a limit is reached; otherwise it waits as PENDING, holding back the cash or shares it needs, "
                        + "until it fills, its DAY session closes (EXPIRED) or it is cancelled. "
                        + "An order rejected for insufficient cash or shares is saved with status FAILED and changes nothing else.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Order completed",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "202", description = "Order accepted and PENDING (market closed or limit not reached)",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "422", description = "Order rejected (insufficient cash or shares); saved with status FAILED",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid request (missing fields, side not BUY/SELL, quantity not positive, "
                        + "LIMIT without limitPrice, GTC on a MARKET order, no market price yet)"),
        @ApiResponse(responseCode = "404", description = "Account or instrument not found")
    })
    public ResponseEntity<OrderResponse> submitOrder(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @Valid @RequestBody OrderRequest request) {
        OrderResult result = orderService.placeOrder(accountId, request.instrumentId(), request.side(), request.quantity(),
                request.orderType(), request.limitPrice(), request.timeInForce());
        HttpStatus status = result.isRejected() ? HttpStatus.UNPROCESSABLE_ENTITY
                : "PENDING".equals(result.order().getStatus()) ? HttpStatus.ACCEPTED
                : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(OrderResponse.from(result));
    }

    /**
     * POST /api/accounts/{accountId}/orders/{orderId}/cancel
     */
    @PostMapping("/{orderId}/cancel")
    @Operation(summary = "Cancel a pending order",
            description = "Cancels a PENDING order and releases the cash or shares it was holding back.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Order cancelled",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "404", description = "Account not found, or the account has no such order"),
        @ApiResponse(responseCode = "409", description = "Order is no longer pending (filled, failed, expired or already cancelled)")
    })
    public OrderResponse cancelOrder(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @PathVariable @Parameter(description = "The order to cancel", example = "42") int orderId) {
        return OrderResponse.from(orderService.cancelOrder(accountId, orderId));
    }

    /**
     * GET /api/accounts/{accountId}/orders
     */
    @GetMapping
    @Operation(summary = "List orders", description = "Returns the account's orders in every status, newest first")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Orders retrieved (empty list if none)"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public List<OrderResponse> listOrders(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId) {
        return orderService.findByAccountId(accountId).stream()
                .map(OrderResponse::from)
                .toList();
    }

    public List<OrderResponse> ordersByDate() {
        return null;
    }
}
