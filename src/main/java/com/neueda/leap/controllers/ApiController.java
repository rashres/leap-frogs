package com.neueda.leap.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

/**
 * Root API Controller - Information and Health Endpoints
 */
@RestController
@RequestMapping("")
@CrossOrigin(origins = "*")
@Tag(name = "API Info", description = "Root API information and health check endpoints")
public class ApiController {

    /**
     * API Root Info
     * GET /api
     */
    @GetMapping
    @Operation(summary = "Get API Information", description = "Returns general information about the Leap Frogs Trading API including version, status, and available endpoints")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Successfully retrieved API info")
    })
    public Map<String, Object> apiInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("service", "Leap Frogs Trading API");
        info.put("version", "0.1.0");
        info.put("status", "UP");
        info.put("endpoints", new String[]{
            "GET /api - This endpoint",
            "GET /api/health - Health check",
            "POST /api/orders - Submit order",
            "GET /api/orders - List orders",
            "GET /api/orders/{id} - Get order",
            "GET /api/accounts - List accounts (coming soon)",
            "GET /api/accounts/{id} - Get account (coming soon)",
            "GET /api/instruments - List instruments (coming soon)"
        });
        return info;
    }

    /**
     * Health Check
     * GET /api/health
     */
    @GetMapping("/health")
    @Operation(summary = "Health Check", description = "Verifies the health status of the Leap Frogs API service and its dependencies")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Service is healthy")
    })
    public Map<String, Object> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "Leap Frogs API");
        health.put("timestamp", System.currentTimeMillis());
        health.put("database", "PENDING (not connected yet)");
        return health;
    }
}
