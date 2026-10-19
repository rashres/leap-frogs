package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.OrderResponse;
import com.neueda.leap.controllers.dto.AuditOrderPageResponse;
import com.neueda.leap.security.AccessControl;
import com.neueda.leap.services.AuditService;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
    private final AccessControl access;

    public AuditController(OrderService orderService, AuditService auditService, AccessControl access) {
        this.orderService = orderService;
        this.auditService = auditService;
        this.access = access;
    }

    @GetMapping("/{accountID}")
    public List<OrderResponse> orderByAccount(@PathVariable int accountID) {
        access.assertCanAccessAudit();
        access.assertCanReadAccount(accountID);
        return orderService.findByAccountId(accountID).stream()
                .map(OrderResponse::from)
                .toList();
    }

    @GetMapping("/orders")
    @Operation(summary = "List audit orders", description = "Returns all orders matching the optional filters, newest first, in a paginated response")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Orders retrieved"),
        @ApiResponse(responseCode = "400", description = "Invalid filters or pagination parameters"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public AuditOrderPageResponse ordersByFilters(
            @RequestParam(required = false) Integer accountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") @Parameter(description = "Zero-based page number") int page,
            @RequestParam(defaultValue = "25") @Parameter(description = "Number of orders per page, from 1 to 100") int size) {
        access.assertCanAccessAudit();
        if (accountId != null) {
            access.assertCanReadAccount(accountId);
        }
        return AuditOrderPageResponse.from(auditService.findOrders(accountId, startDate, endDate, page, size));
    }
}
