package com.neueda.leap.controllers.dto;

import com.neueda.leap.services.AuditService.AuditPage;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "A page of audit orders and pagination metadata")
public record AuditOrderPageResponse(
        List<OrderResponse> orders,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasPrevious,
        boolean hasNext) {

    public static AuditOrderPageResponse from(AuditPage page) {
        return new AuditOrderPageResponse(
                page.orders().stream().map(OrderResponse::from).toList(),
                page.page(),
                page.size(),
                page.totalElements(),
                page.totalPages(),
                page.page() > 0,
                page.page() + 1 < page.totalPages());
    }
}