package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.OrderRequest;
import com.neueda.leap.services.domain.Order;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * REST API Controller for Order Management
 * Provides endpoints to submit, retrieve, and manage orders
 */
@RestController
@RequestMapping("/{accountID}/orders")
@CrossOrigin(origins = "*")
@Tag(name = "Orders", description = "Order management endpoints")
public class OrderController {

    private final OrderService executor;
    private static final Map<Integer, Order> orderRepository = new HashMap<>();
    private static int orderIdCounter = 1;

    public OrderController(OrderService executor) {
        this.executor = executor;
    }
    /**
     * Submit a new order
     * POST /api/orders
     */
    @PostMapping
    @Operation(
        summary = "Submit a new order",
        description = "Creates and submits a new trading order. Validates account and instrument IDs, then creates an order with the specified side and quantity. "
                    + "Failures are reported in the response body with status ERROR rather than as an HTTP error code."
    )
    @RequestBody(
        required = true,
        description = "Order submission details including account ID, instrument ID, trade side (BUY/SELL), and quantity",
        content = @Content(mediaType = "application/json", schema = @Schema(implementation = OrderRequest.class))
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Request processed. Check the status field for SUCCESS or ERROR.",
            content = @Content(mediaType = "application/json", examples = {
                @ExampleObject(name = "Success", value = """
                        {"status":"SUCCESS","orderId":1,"message":"Order submitted successfully","side":"BUY","quantity":"10"}"""),
                @ExampleObject(name = "Validation error", value = """
                        {"status":"ERROR","message":"accountId and instrumentId are required"}""")
            })
        )
    })
    public Map<String, Object> submitOrder(
            @org.springframework.web.bind.annotation.RequestBody OrderRequest request,
            @PathVariable
            @Parameter(description = "The unique identifier of the account submitting the order", example = "1001", required = true)
            int accountID) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate input
            if (request.accountId() == null || request.instrumentId() == null) {
                response.put("status", "ERROR");
                response.put("message", "accountId and instrumentId are required");
                return response;
            }

            // Create order (will be linked to real Account/Instrument once we have DB)
            Order order = new Order(null, null, request.side(), new BigDecimal(request.quantity()));
            
            // For now, store in memory
            int orderId = orderIdCounter++;
            orderRepository.put(orderId, order);

            //send to order service
            executor.process_order(order, accountID);

            response.put("status", "SUCCESS");
            response.put("orderId", orderId);
            response.put("message", "Order submitted successfully");
            response.put("side", request.side());
            response.put("quantity", request.quantity());
            
        } catch (Exception e) {
            response.put("status", "ERROR");
            response.put("message", "Failed to submit order: " + e.getMessage());
        }

        return response;
    }

    /**
     * Get order by ID
     * GET /api/orders/{orderId}
     */
    @GetMapping("/{orderId}")
    @Operation(
        summary = "Get order by ID",
        description = "Retrieves a specific order by its ID. A missing order is reported in the body with status NOT_FOUND, not as an HTTP 404.",
        parameters = @Parameter(
            name = "accountID", in = ParameterIn.PATH, required = true,
            description = "The unique identifier of the account that owns the order", example = "1001"
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Request processed. Check the status field for SUCCESS or NOT_FOUND.",
            content = @Content(mediaType = "application/json", examples = {
                @ExampleObject(name = "Order found", value = """
                        {"status":"SUCCESS","orderId":1,"side":"BUY","quantity":10,"price":150.50,"orderStatus":"COMPLETE"}"""),
                @ExampleObject(name = "Order not found", value = """
                        {"status":"NOT_FOUND","message":"Order 1 not found"}""")
            })
        )
    })
    public Map<String, Object> getOrder(@PathVariable @Parameter(description = "The unique identifier of the order", example = "1") Integer orderId) {
        Map<String, Object> response = new HashMap<>();
        
        Order order = orderRepository.get(orderId);
        if (order == null) {
            response.put("status", "NOT_FOUND");
            response.put("message", "Order " + orderId + " not found");
            return response;
        }

        response.put("status", "SUCCESS");
        response.put("orderId", orderId);
        response.put("side", order.getSide());
        response.put("quantity", order.getQuantity());
        response.put("price", order.getPrice());
        response.put("orderStatus", order.getStatus());
        
        return response;
    }

    /**
     * List all orders
     * GET /api/orders
     */
    @GetMapping
    @Operation(
        summary = "List all orders",
        description = "Retrieves a list of all orders in the system. Orders are returned keyed by order ID.",
        parameters = @Parameter(
            name = "accountID", in = ParameterIn.PATH, required = true,
            description = "The unique identifier of the account in the request path", example = "1001"
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully retrieved all orders",
            content = @Content(mediaType = "application/json", examples = @ExampleObject(value = """
                    {"status":"SUCCESS","totalOrders":1,"orders":{"1":{"side":"BUY","quantity":10,"price":150.50,"status":"COMPLETE"}}}"""))
        )
    })
    public Map<String, Object> listOrders() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("totalOrders", orderRepository.size());
        response.put("orders", orderRepository);
        return response;
    }

    /**
     * Health check endpoint
     * GET /api/orders/health
     */
    @GetMapping("/health")
    @Operation(
        summary = "Order service health check",
        description = "Verifies the health status of the order service",
        parameters = @Parameter(
            name = "accountID", in = ParameterIn.PATH, required = true,
            description = "The unique identifier of the account in the request path", example = "1001"
        )
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Service is healthy",
            content = @Content(mediaType = "application/json", examples = @ExampleObject(value = """
                    {"status":"UP","service":"OrderService"}"""))
        )
    })
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "OrderService");
        return response;
    }
}
