package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.OrderResponse;
import com.neueda.leap.services.AuditService;
import com.neueda.leap.services.OrderService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

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


}
