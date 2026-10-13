package com.neueda.leap.services;

import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.Order;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public class AuditService {

    public static final int DEFAULT_PAGE_SIZE = 25;
    public static final int MAX_PAGE_SIZE = 100;

    private final AccountService accountService;
    private final OrderMapper orderMapper;

    public AuditService(AccountService accountService, OrderMapper orderMapper) {
        this.accountService = accountService;
        this.orderMapper = orderMapper;
    }

    public AuditPage findOrders(
            Integer accountId,
            LocalDate startDate,
            LocalDate endDate,
            int page,
            int size) {
        validatePage(page, size);
        if (accountId != null) {
            accountService.findById(accountId);
        }
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new InvalidOrderException("startDate must be before or equal to endDate");
        }

        LocalDateTime startDateTime = startDate == null ? null : startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate == null ? null : endDate.atTime(LocalTime.MAX);
        long totalElements = orderMapper.countByFilters(accountId, startDateTime, endDateTime);
        long offset = (long) page * size;
        List<Order> orders = totalElements == 0 || offset >= totalElements
                ? List.of()
                : orderMapper.findByFiltersPage(accountId, startDateTime, endDateTime, size, offset);
        int totalPages = totalElements == 0 ? 0 : (int) ((totalElements + size - 1) / size);

        return new AuditPage(orders, page, size, totalElements, totalPages);
    }

    private void validatePage(int page, int size) {
        if (page < 0) {
            throw new InvalidOrderException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidOrderException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
    }

    public record AuditPage(
            List<Order> orders,
            int page,
            int size,
            long totalElements,
            int totalPages) {
    }
}