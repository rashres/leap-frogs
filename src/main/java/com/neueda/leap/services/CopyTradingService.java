package com.neueda.leap.services;

import com.neueda.leap.mappers.CopyTradingMapper;
import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Copy trading: accounts follow lead traders, and every new order a lead
 * trader places is copied to each follower, scaled to what they allocated.
 */
@Service
public class CopyTradingService {

    private static final Logger logger = LoggerFactory.getLogger(CopyTradingService.class);

    /** Copied quantities are rounded down to this many decimal places. */
    private static final int QUANTITY_SCALE = 4;
    private static final int RECENT_ORDERS = 25;

    private final CopyTradingMapper copyTradingMapper;
    private final OrderMapper orderMapper;
    private final HoldingsMapper holdingsMapper;
    private final AccountService accountService;
    private final OrderService orderService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public CopyTradingService(CopyTradingMapper copyTradingMapper, OrderMapper orderMapper, HoldingsMapper holdingsMapper,
                              AccountService accountService, OrderService orderService,
                              TransactionTemplate transactionTemplate, Clock clock) {
        this.copyTradingMapper = copyTradingMapper;
        this.orderMapper = orderMapper;
        this.holdingsMapper = holdingsMapper;
        this.accountService = accountService;
        this.orderService = orderService;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    public List<CopyTraderSummary> findTraders() {
        return copyTradingMapper.findTraders().stream().map(this::summarize).toList();
    }

    public CopyTraderSummary findTrader(int copyTraderId) {
        return summarize(traderById(copyTraderId));
    }

    /** The trader's latest filled orders, newest first. */
    public List<Order> findTraderOrders(int copyTraderId) {
        CopyTrader trader = traderById(copyTraderId);
        return orderMapper.findByAccountId(trader.getAccountId()).stream()
                .filter(o -> "COMPLETE".equals(o.getStatus()))
                .limit(RECENT_ORDERS)
                .toList();
    }

    public List<CopySubscription> findSubscriptions(int accountId) {
        accountService.findById(accountId);
        return copyTradingMapper.findActiveByFollower(accountId);
    }

    public List<CopiedOrder> findCopiedOrders(int accountId) {
        accountService.findById(accountId);
        return copyTradingMapper.findCopiedOrders(accountId);
    }

    /**
     * Starts copying a trader. Only trades placed from now on are copied; the
     * follower does not buy into the trader's existing positions.
     */
    @Transactional
    public CopySubscription follow(int accountId, int copyTraderId, BigDecimal allocation) {
        Account account = accountService.findById(accountId);
        CopyTrader trader = traderById(copyTraderId);
        if (trader.getAccountId() == accountId) {
            throw new InvalidCopyTradeException("An account cannot copy its own trades");
        }
        if (allocation == null || allocation.signum() <= 0) {
            throw new InvalidCopyTradeException("allocation must be greater than 0");
        }
        if (allocation.compareTo(account.getCashBalance()) > 0) {
            throw new InvalidCopyTradeException("Allocation " + allocation + " is more than the cash balance " + account.getCashBalance());
        }
        boolean alreadyCopying = copyTradingMapper.findActiveByFollower(accountId).stream()
                .anyMatch(s -> s.getCopyTraderId() == copyTraderId);
        if (alreadyCopying) {
            throw new InvalidCopyTradeException("Already copying " + trader.getName());
        }
        CopySubscription subscription = new CopySubscription(accountId, copyTraderId, allocation, clock.instant());
        copyTradingMapper.insertSubscription(subscription);
        return copyTradingMapper.findSubscriptionById(subscription.getSubscriptionId());
    }

    /** Stops copying. Orders already copied stay as they are. */
    @Transactional
    public void unfollow(int accountId, int subscriptionId) {
        accountService.findById(accountId);
        if (copyTradingMapper.stopSubscription(accountId, subscriptionId, clock.instant()) == 0) {
            throw new ResourceNotFoundException("Copy subscription", subscriptionId);
        }
    }

    /**
     * Copies a lead trader's new order to everyone following them. Does nothing
     * for accounts that are not lead traders or for rejected orders. Each
     * follower's copy is its own transaction, so one follower short of cash
     * does not stop the others, and a failure here never undoes the leader's order.
     */
    public void mirror(Order leaderOrder) {
        if ("FAILED".equals(leaderOrder.getStatus())) {
            return;
        }
        CopyTrader trader;
        List<CopySubscription> subscriptions;
        try {
            trader = copyTradingMapper.findTraderByAccountId(leaderOrder.getAccount().getAccountId());
            if (trader == null) {
                return;
            }
            subscriptions = copyTradingMapper.findActiveByTrader(trader.getCopyTraderId());
        } catch (RuntimeException e) {
            // Most likely the copy trading tables have not been created yet.
            logger.warn("Copy trading unavailable, order {} not copied: {}", leaderOrder.getOrderId(), e.getMessage());
            return;
        }
        for (CopySubscription subscription : subscriptions) {
            try {
                transactionTemplate.executeWithoutResult(status -> copyTo(subscription, trader, leaderOrder));
            } catch (RuntimeException e) {
                logger.warn("Could not copy order {} to account {}", leaderOrder.getOrderId(),
                        subscription.getFollowerAccountId(), e);
            }
        }
    }

    private void copyTo(CopySubscription subscription, CopyTrader trader, Order leaderOrder) {
        BigDecimal quantity = copiedQuantity(subscription, trader, leaderOrder);
        if (quantity.signum() <= 0) {
            return;
        }
        OrderResult result = orderService.placeOrder(subscription.getFollowerAccountId(),
                leaderOrder.getInstrument().getInstrumentId(), leaderOrder.getSide(), quantity,
                leaderOrder.getOrderType(), leaderOrder.getLimitPrice(), leaderOrder.getTimeInForce());
        copyTradingMapper.insertCopyTrade(result.order().getOrderId(), leaderOrder.getOrderId(),
                subscription.getSubscriptionId());
        logger.info("Copied order {} to account {} as order {} ({})", leaderOrder.getOrderId(),
                subscription.getFollowerAccountId(), result.order().getOrderId(), result.order().getStatus());
    }

    /**
     * A buy is scaled by allocation / the trader's equity. A sell closes the
     * same share of the follower's position as the trader closed of theirs.
     */
    private BigDecimal copiedQuantity(CopySubscription subscription, CopyTrader trader, Order leaderOrder) {
        int instrumentId = leaderOrder.getInstrument().getInstrumentId();
        if (leaderOrder.isBuy()) {
            if (trader.getEquity() == null || trader.getEquity().signum() <= 0) {
                return BigDecimal.ZERO;
            }
            return leaderOrder.getQuantity().multiply(subscription.getAllocation())
                    .divide(trader.getEquity(), QUANTITY_SCALE, RoundingMode.DOWN);
        }

        BigDecimal followerHeld = heldQuantity(subscription.getFollowerAccountId(), instrumentId);
        BigDecimal leaderHeld = heldQuantity(trader.getAccountId(), instrumentId);
        // A filled sell has already come off the trader's holding.
        BigDecimal leaderBefore = "COMPLETE".equals(leaderOrder.getStatus())
                ? leaderHeld.add(leaderOrder.getQuantity())
                : leaderHeld;
        if (followerHeld.signum() <= 0 || leaderBefore.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        if (leaderOrder.getQuantity().compareTo(leaderBefore) >= 0) {
            return followerHeld; // the trader closed the whole position
        }
        return followerHeld.multiply(leaderOrder.getQuantity())
                .divide(leaderBefore, QUANTITY_SCALE, RoundingMode.DOWN);
    }

    private BigDecimal heldQuantity(int accountId, int instrumentId) {
        Holding holding = holdingsMapper.findByAccountIdAndInstrumentId(accountId, instrumentId);
        return holding == null ? BigDecimal.ZERO : holding.getQuantity();
    }

    private CopyTrader traderById(int copyTraderId) {
        CopyTrader trader = copyTradingMapper.findTraderById(copyTraderId);
        if (trader == null) {
            throw new ResourceNotFoundException("Copy trader", copyTraderId);
        }
        return trader;
    }

    /** Return, win rate and trade counts from the trader's filled orders, oldest first. */
    private CopyTraderSummary summarize(CopyTrader trader) {
        List<Order> filled = new ArrayList<>(orderMapper.findByAccountId(trader.getAccountId()).stream()
                .filter(o -> "COMPLETE".equals(o.getStatus()))
                .toList());
        Collections.reverse(filled);
        Map<Integer, BigDecimal> heldQuantity = new HashMap<>();
        Map<Integer, BigDecimal> heldCost = new HashMap<>();
        int closed = 0;
        int wins = 0;
        for (Order order : filled) {
            int id = order.getInstrument().getInstrumentId();
            BigDecimal quantity = heldQuantity.getOrDefault(id, BigDecimal.ZERO);
            BigDecimal cost = heldCost.getOrDefault(id, BigDecimal.ZERO);
            if (order.isBuy()) {
                heldQuantity.put(id, quantity.add(order.getQuantity()));
                heldCost.put(id, cost.add(order.getValue()));
            } else if (quantity.signum() > 0) {
                BigDecimal averageCost = cost.divide(quantity, 8, RoundingMode.HALF_UP);
                BigDecimal sold = order.getQuantity().min(quantity);
                closed++;
                if (order.getPrice().compareTo(averageCost) > 0) {
                    wins++;
                }
                heldQuantity.put(id, quantity.subtract(sold));
                heldCost.put(id, cost.subtract(averageCost.multiply(sold)));
            }
        }

        BigDecimal start = trader.getStartingCapital();
        BigDecimal returnPercent = start == null || start.signum() <= 0 || trader.getEquity() == null
                ? null
                : trader.getEquity().subtract(start).multiply(BigDecimal.valueOf(100)).divide(start, 2, RoundingMode.HALF_UP);
        BigDecimal winRate = closed == 0
                ? null
                : BigDecimal.valueOf(wins * 100L).divide(BigDecimal.valueOf(closed), 1, RoundingMode.HALF_UP);
        return new CopyTraderSummary(trader, returnPercent, winRate, closed, filled.size());
    }
}
