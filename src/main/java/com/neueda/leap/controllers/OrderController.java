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
            description = "Places a BUY or SELL order for the account. A completed order updates cash and holdings; "
                        + "an order rejected for insufficient cash or shares is saved with status FAILED and changes nothing else.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Order completed",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "422", description = "Order rejected (insufficient cash or shares); saved with status FAILED",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid request (missing fields, side not BUY/SELL, quantity not positive)"),
        @ApiResponse(responseCode = "404", description = "Account or instrument not found")
    })
    public ResponseEntity<OrderResponse> submitOrder(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId,
            @Valid @RequestBody OrderRequest request) {
        OrderResult result = orderService.placeOrder(accountId, request.instrumentId(), request.side(), request.quantity());
        HttpStatus status = result.isRejected() ? HttpStatus.UNPROCESSABLE_ENTITY : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(OrderResponse.from(result));
    }

    /**
     * GET /api/accounts/{accountId}/orders
     */
    @GetMapping
    @Operation(summary = "List orders", description = "Returns the account's orders (COMPLETE and FAILED), newest first")
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
}
