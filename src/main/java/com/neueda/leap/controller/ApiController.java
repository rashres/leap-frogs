package com.neueda.leap.controller;

import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

/**
 * Root API Controller - Information and Health Endpoints
 */
@RestController
@RequestMapping("")
@CrossOrigin(origins = "*")
public class ApiController {

    /**
     * API Root Info
     * GET /api
     */
    @GetMapping
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
    public Map<String, Object> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "Leap Frogs API");
        health.put("timestamp", System.currentTimeMillis());
        health.put("database", "PENDING (not connected yet)");
        return health;
    }
}
