package com.neueda.leap.controllers;

import com.neueda.leap.services.domain.Order;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.Operation;
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
@RequestMapping("/orders")
@CrossOrigin(origins = "*")
@Tag(name = "Orders", description = "Order management endpoints")
public class OrderController {
    
    private static final OrderService executor = new OrderService();
    private static final Map<Integer, Order> orderRepository = new HashMap<>();
    private static int orderIdCounter = 1;

    /**
     * Submit a new order
     * POST /api/orders
     * 
     * Request Body:
     * {
     *   "accountId": 1001,
     *   "instrumentId": 1,
     *   "side": "BUY",
     *   "quantity": "10"
     * }
     */
    @PostMapping
    @Operation(summary = "Submit a new order", description = "Creates and submits a new trading order")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Order submitted successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid order request")
    })
    public Map<String, Object> submitOrder(@RequestBody OrderRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate input
            if (request.getAccountId() == null || request.getInstrumentId() == null) {
                response.put("status", "ERROR");
                response.put("message", "accountId and instrumentId are required");
                return response;
            }

            // Create order (will be linked to real Account/Instrument once we have DB)
            Order order = new Order(null, null, request.getSide(), new BigDecimal(request.getQuantity()));
            
            // For now, store in memory
            int orderId = orderIdCounter++;
            orderRepository.put(orderId, order);

            response.put("status", "SUCCESS");
            response.put("orderId", orderId);
            response.put("message", "Order submitted successfully");
            response.put("side", request.getSide());
            response.put("quantity", request.getQuantity());
            
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
    @Operation(summary = "Get order by ID", description = "Retrieves a specific order by its ID")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Order found"),
        @ApiResponse(responseCode = "404", description = "Order not found")
    })
    public Map<String, Object> getOrder(@PathVariable Integer orderId) {
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
    @Operation(summary = "List all orders", description = "Retrieves a list of all orders in the system")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved all orders")
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
    @Operation(summary = "Order service health check", description = "Verifies the health status of the order service")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Service is healthy")
    })
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "OrderService");
        return response;
    }
}

/**
 * Request body for submitting orders
 */
class OrderRequest {
    private Integer accountId;
    private Integer instrumentId;
    private String side;
    private String quantity;

    // Getters and Setters
    public Integer getAccountId() { return accountId; }
    public void setAccountId(Integer accountId) { this.accountId = accountId; }

    public Integer getInstrumentId() { return instrumentId; }
    public void setInstrumentId(Integer instrumentId) { this.instrumentId = instrumentId; }

    public String getSide() { return side; }
    public void setSide(String side) { this.side = side; }

    public String getQuantity() { return quantity; }
    public void setQuantity(String quantity) { this.quantity = quantity; }
}
