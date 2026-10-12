package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.OrderResponse;
import com.neueda.leap.services.AuditService;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/audit")
@CrossOrigin(origins = "*")
@Tag(name = "Audit", description = "Auditing endpoints")
public class AuditController {

    private final OrderService orderService;
    private final AuditService auditService;

    public AuditController(OrderService orderService, AuditService auditService) {
        this.orderService = orderService;
        this.auditService = auditService;
    }

    @GetMapping("/{accountID}")
    public List<OrderResponse> orderByAccount(@PathVariable int accountID) {
        return orderService.findByAccountId(accountID).stream()
                .map(OrderResponse::from)
                .toList();
    }

    @GetMapping("/orders")
    public List<OrderResponse> ordersByFilters(
            @RequestParam(required = false) Integer accountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return orderService.findByFilters(accountId, startDate, endDate).stream()
                .map(OrderResponse::from)
                .toList();
    }


}
