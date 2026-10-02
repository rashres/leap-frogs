package com.neueda.leap.services;

import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class OrderService {

    private final AccountService accountService;
    private final InstrumentService instrumentService;
    private final HoldingsMapper holdingsMapper;
    private final OrderMapper orderMapper;

    public OrderService(AccountService accountService, InstrumentService instrumentService,
                        HoldingsMapper holdingsMapper, OrderMapper orderMapper) {
        this.accountService = accountService;
        this.instrumentService = instrumentService;
        this.holdingsMapper = holdingsMapper;
        this.orderMapper = orderMapper;
    }

    /**
     * Places an order. All database changes happen together or not at all.
     * Rejected orders (not enough cash or shares) are saved with status FAILED and change nothing else.
     */
    @Transactional
    public OrderResult placeOrder(int accountId, int instrumentId, String side, BigDecimal quantity) {
        Account account = accountService.findById(accountId);
        Instrument instrument = instrumentService.findById(instrumentId);

        String normalizedSide = side == null ? null : side.trim().toUpperCase();
        if (!OrderValidator.isValidTransactionType(normalizedSide)) {
            throw new InvalidOrderException("side must be BUY or SELL");
        }
        if (quantity == null || !OrderValidator.isValidQuantity(quantity)) {
            throw new InvalidOrderException("quantity must be greater than 0");
        }

        Order order = new Order(account, instrument, normalizedSide, quantity);
        BigDecimal currentQuantity = currentHoldingQuantity(accountId, instrumentId);

        String rejectionReason = checkFunds(order, currentQuantity);
        if (rejectionReason != null) {
            order.setStatus("FAILED");
            orderMapper.insertOrder(order);
            return OrderResult.rejected(order, rejectionReason);
        }

        order.setStatus("COMPLETE");
        orderMapper.insertOrder(order);
        accountService.updateBalance(order.getValue(), account, normalizedSide);

        BigDecimal newQuantity = "BUY".equals(normalizedSide)
                ? currentQuantity.add(quantity)
                : currentQuantity.subtract(quantity);
        holdingsMapper.upsertHolding(new Holding(accountId, instrument, newQuantity));

        return OrderResult.completed(order);
    }

    public List<Order> findByAccountId(int accountId) {
        accountService.findById(accountId);
        return orderMapper.findByAccountId(accountId);
    }

    private BigDecimal currentHoldingQuantity(int accountId, int instrumentId) {
        Holding holding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        return holding == null ? BigDecimal.ZERO : holding.getQuantity();
    }

    private String checkFunds(Order order, BigDecimal currentQuantity) {
        if ("BUY".equals(order.getSide())) {
            if (!OrderValidator.isValidCashBalance(order.getAccount(), order.getQuantity(), order.getPrice())) {
                return "Insufficient cash: required " + order.getValue()
                        + ", available " + order.getAccount().getCashBalance();
            }
        } else if (currentQuantity.compareTo(order.getQuantity()) < 0) {
            return "Insufficient shares: required " + order.getQuantity()
                    + ", available " + currentQuantity;
        }
        return null;
    }
}
