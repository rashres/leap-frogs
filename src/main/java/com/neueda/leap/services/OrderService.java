package com.neueda.leap.services;

import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class OrderService {

    private final AccountService accountService;
    private final InstrumentService instrumentService;
    private final HoldingsMapper holdingsMapper;
    private final OrderMapper orderMapper;
    private final MarketHours marketHours;

    public OrderService(AccountService accountService, InstrumentService instrumentService,
                        HoldingsMapper holdingsMapper, OrderMapper orderMapper, MarketHours marketHours) {
        this.accountService = accountService;
        this.instrumentService = instrumentService;
        this.holdingsMapper = holdingsMapper;
        this.orderMapper = orderMapper;
        this.marketHours = marketHours;
    }

    /** A market order that is good for the day. */
    @Transactional
    public OrderResult placeOrder(int accountId, int instrumentId, String side, BigDecimal quantity) {
        return placeOrder(accountId, instrumentId, side, quantity, null, null, null);
    }

    /**
     * Places an order. All database changes happen together or not at all.
     *
     * It fills now when its market is open and, for a limit order, the price is
     * at the limit or better. Otherwise it is saved PENDING and holds back the
     * cash (buy) or shares (sell) it needs, so they cannot be spent twice;
     * PendingOrderProcessor fills or expires it later. Rejected orders (not
     * enough cash or shares) are saved with status FAILED and change nothing else.
     *
     * @param orderType   MARKET (default) or LIMIT
     * @param limitPrice  required for LIMIT, not allowed for MARKET
     * @param timeInForce DAY (default) or GTC; GTC only for LIMIT
     */
    @Transactional
    public OrderResult placeOrder(int accountId, int instrumentId, String side, BigDecimal quantity,
                                  String orderType, BigDecimal limitPrice, String timeInForce) {
        Account account = accountService.findById(accountId);
        Instrument instrument = instrumentService.findById(instrumentId);

        String normalizedSide = side == null ? null : side.trim().toUpperCase();
        if (!OrderValidator.isValidTransactionType(normalizedSide)) {
            throw new InvalidOrderException("side must be BUY or SELL");
        }
        if (quantity == null || !OrderValidator.isValidQuantity(quantity)) {
            throw new InvalidOrderException("quantity must be greater than 0");
        }
        String type = normalize(orderType, "MARKET");
        if (!OrderValidator.isValidOrderType(type)) {
            throw new InvalidOrderException("orderType must be MARKET or LIMIT");
        }
        String tif = normalize(timeInForce, "DAY");
        if (!OrderValidator.isValidTimeInForce(tif)) {
            throw new InvalidOrderException("timeInForce must be DAY or GTC");
        }
        if ("LIMIT".equals(type) && (limitPrice == null || !OrderValidator.isValidPrice(limitPrice))) {
            throw new InvalidOrderException("limitPrice must be greater than 0 for a LIMIT order");
        }
        if ("MARKET".equals(type) && limitPrice != null) {
            throw new InvalidOrderException("limitPrice is only allowed on a LIMIT order");
        }
        if ("MARKET".equals(type) && "GTC".equals(tif)) {
            throw new InvalidOrderException("GTC is only allowed on a LIMIT order");
        }
        // Checked up front: a FAILED row still needs a price, and the column is NOT NULL.
        if (!OrderValidator.isValidPrice(instrument.getPrice())) {
            throw new InvalidOrderException(instrument.getSymbol() + " has no market price yet; run the price fetcher");
        }

        Order order = new Order(account, instrument, normalizedSide, quantity);
        order.setOrderType(type);
        order.setLimitPrice(limitPrice);
        order.setTimeInForce(tif);

        Instant now = marketHours.now();
        boolean fillsNow = marketHours.isOpen(instrument, now) && order.canFillAt(instrument.getPrice());

        // A buy is checked against what it can cost: the market price if it fills
        // now, its reservation if it waits.
        BigDecimal cost = fillsNow ? order.getValue() : order.getReservedValue();
        String rejectionReason = checkFunds(order, cost, availableCash(account), availableShares(accountId, instrumentId));
        if (rejectionReason != null) {
            order.setStatus("FAILED");
            orderMapper.insertOrder(order);
            return OrderResult.rejected(order, rejectionReason);
        }

        if (!fillsNow) {
            order.setStatus("PENDING");
            order.setExpiresAt("DAY".equals(tif) ? marketHours.sessionEnd(instrument, now) : null);
            orderMapper.insertOrder(order);
            return OrderResult.completed(order);
        }

        order.setStatus("COMPLETE");
        orderMapper.insertOrder(order);
        settle(order, account);
        return OrderResult.completed(order);
    }

    /**
     * Fills or expires one pending order if it is due. Called by
     * PendingOrderProcessor; does nothing if the order is no longer pending.
     *
     * @return the order's status afterwards
     */
    @Transactional
    public String processPending(int orderId) {
        Order order = orderMapper.findById(orderId);
        if (order == null || !"PENDING".equals(order.getStatus())) {
            return order == null ? null : order.getStatus();
        }
        Instant now = marketHours.now();
        if (order.getExpiresAt() != null && !now.isBefore(order.getExpiresAt())) {
            orderMapper.closePending(orderId, "EXPIRED");
            return "EXPIRED";
        }

        Instrument instrument = instrumentService.findById(order.getInstrument().getInstrumentId());
        BigDecimal marketPrice = instrument.getPrice();
        if (!marketHours.isOpen(instrument, now) || !order.canFillAt(marketPrice)) {
            return "PENDING";
        }

        Account account = accountService.findById(order.getAccount().getAccountId());
        // This order's own reservation is about to become the real trade, so it
        // must not count against itself.
        BigDecimal cash = availableCash(account);
        BigDecimal shares = availableShares(account.getAccountId(), instrument.getInstrumentId());
        if (order.isBuy()) {
            cash = cash.add(order.getReservedValue());
        } else {
            shares = shares.add(order.getQuantity());
        }
        // A market buy reserved at yesterday's price fails here if the market opened higher than the account can pay.
        if (checkFunds(order, order.getQuantity().multiply(marketPrice), cash, shares) != null) {
            orderMapper.closePending(orderId, "FAILED");
            return "FAILED";
        }

        if (orderMapper.markFilled(orderId, marketPrice, now) == 0) {
            return orderMapper.findById(orderId).getStatus(); // cancelled meanwhile
        }
        order.fill(marketPrice, now);
        settle(order, account);
        return "COMPLETE";
    }

    /**
     * Cancels one of the account's pending orders, releasing what it held back.
     *
     * @throws ResourceNotFoundException if the account has no such order
     * @throws OrderNotCancellableException if the order has already filled, failed, expired or been cancelled
     */
    @Transactional
    public Order cancelOrder(int accountId, int orderId) {
        accountService.findById(accountId);
        Order order = orderMapper.findById(orderId);
        if (order == null || order.getAccount().getAccountId() != accountId) {
            throw new ResourceNotFoundException("Order", orderId);
        }
        if (!"PENDING".equals(order.getStatus()) || orderMapper.closePending(orderId, "CANCELLED") == 0) {
            Order current = orderMapper.findById(orderId);
            throw new OrderNotCancellableException(orderId, current.getStatus());
        }
        order.setStatus("CANCELLED");
        return order;
    }

    public List<Order> findByAccountId(int accountId) {
        accountService.findById(accountId);
        return orderMapper.findByAccountId(accountId);
    }

    /** Moves the cash and shares of a filled order. */
    private void settle(Order order, Account account) {
        int accountId = account.getAccountId();
        int instrumentId = order.getInstrument().getInstrumentId();
        BigDecimal currentQuantity = currentHoldingQuantity(accountId, instrumentId);
        accountService.updateBalance(order.getValue(), account, order.getSide());
        BigDecimal newQuantity = order.isBuy()
                ? currentQuantity.add(order.getQuantity())
                : currentQuantity.subtract(order.getQuantity());
        holdingsMapper.upsertHolding(new Holding(accountId, order.getInstrument(), newQuantity));
    }

    /** Cash not already held back by pending buys. */
    private BigDecimal availableCash(Account account) {
        return account.getCashBalance().subtract(orderMapper.reservedCash(account.getAccountId()));
    }

    /** Shares not already held back by pending sells. */
    private BigDecimal availableShares(int accountId, int instrumentId) {
        return currentHoldingQuantity(accountId, instrumentId).subtract(orderMapper.reservedShares(accountId, instrumentId));
    }

    private BigDecimal currentHoldingQuantity(int accountId, int instrumentId) {
        Holding holding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        return holding == null ? BigDecimal.ZERO : holding.getQuantity();
    }

    private static String checkFunds(Order order, BigDecimal cost, BigDecimal cash, BigDecimal shares) {
        if (order.isBuy()) {
            if (cash.compareTo(cost) < 0) {
                return "Insufficient cash: required " + cost + ", available " + cash;
            }
        } else if (shares.compareTo(order.getQuantity()) < 0) {
            return "Insufficient shares: required " + order.getQuantity() + ", available " + shares;
        }
        return null;
    }

    private static String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toUpperCase(Locale.ROOT);
    }
}
