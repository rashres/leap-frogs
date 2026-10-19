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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
    /** Daily equity points needed before a Sharpe ratio means anything. */
    private static final int MIN_SHARPE_RETURNS = 20;
    /** The equity curve is daily, weekends included. */
    private static final double PERIODS_PER_YEAR = 365;

    private final CopyTradingMapper copyTradingMapper;
    private final OrderMapper orderMapper;
    private final HoldingsMapper holdingsMapper;
    private final AccountService accountService;
    private final OrderService orderService;
    private final PortfolioHistoryService portfolioHistoryService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public CopyTradingService(CopyTradingMapper copyTradingMapper, OrderMapper orderMapper, HoldingsMapper holdingsMapper,
                              AccountService accountService, OrderService orderService,
                              PortfolioHistoryService portfolioHistoryService,
                              TransactionTemplate transactionTemplate, Clock clock) {
        this.copyTradingMapper = copyTradingMapper;
        this.orderMapper = orderMapper;
        this.holdingsMapper = holdingsMapper;
        this.accountService = accountService;
        this.orderService = orderService;
        this.portfolioHistoryService = portfolioHistoryService;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    public List<CopyTraderSummary> findTraders() {
        return copyTradingMapper.findTraders().stream().map(this::summarize).toList();
    }

    public CopyTraderSummary findTrader(int copyTraderId) {
        return summarize(traderById(copyTraderId));
    }

    /** Every filled order of the trader, newest first. */
    public List<Order> findTraderOrders(int copyTraderId) {
        CopyTrader trader = traderById(copyTraderId);
        return orderMapper.findByAccountId(trader.getAccountId()).stream()
                .filter(o -> "COMPLETE".equals(o.getStatus()))
                .toList();
    }

    /** The account's active copies, each with its position and profit or loss. */
    public List<CopySubscription> findSubscriptions(int accountId) {
        accountService.findById(accountId);
        List<CopySubscription> subscriptions = copyTradingMapper.findActiveByFollower(accountId);
        subscriptions.forEach(this::withPerformance);
        return subscriptions;
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
    public CopySubscription follow(int accountId, int copyTraderId, CopySettings settings) {
        Account account = accountService.findById(accountId);
        CopyTrader trader = traderById(copyTraderId);
        if (trader.getAccountId() == accountId) {
            throw new InvalidCopyTradeException("An account cannot copy its own trades");
        }
        validate(settings);
        if (settings.allocation().compareTo(account.getCashBalance()) > 0) {
            throw new InvalidCopyTradeException("Allocation " + settings.allocation() + " is more than the cash balance "
                    + account.getCashBalance());
        }
        boolean alreadyCopying = copyTradingMapper.findActiveByFollower(accountId).stream()
                .anyMatch(s -> s.getCopyTraderId() == copyTraderId);
        if (alreadyCopying) {
            throw new InvalidCopyTradeException("Already copying " + trader.getName());
        }
        CopySubscription subscription = new CopySubscription(accountId, copyTraderId, settings, clock.instant());
        copyTradingMapper.insertSubscription(subscription);
        return withPerformance(copyTradingMapper.findSubscriptionById(subscription.getSubscriptionId()));
    }

    /**
     * Changes an active copy's settings, and pauses or resumes it. A copy the
     * stop-loss paused cannot resume while its loss is still past the stop-loss.
     */
    @Transactional
    public CopySubscription updateSettings(int accountId, int subscriptionId, CopySettings settings) {
        Account account = accountService.findById(accountId);
        CopySubscription subscription = copyTradingMapper.findSubscriptionById(subscriptionId);
        if (subscription == null || subscription.getFollowerAccountId() != accountId || subscription.getStoppedAt() != null) {
            throw new ResourceNotFoundException("Copy subscription", subscriptionId);
        }
        validate(settings);
        CopyBook book = bookFor(subscriptionId);
        // Money already in this copy's positions came out of the cash balance, so it counts towards what may be allocated.
        BigDecimal mostAllowed = account.getCashBalance().add(book.committed());
        if (settings.allocation().compareTo(mostAllowed) > 0) {
            throw new InvalidCopyTradeException("Allocation " + settings.allocation() + " is more than the cash balance plus what this copy has invested ("
                    + mostAllowed.setScale(2, RoundingMode.HALF_UP) + ")");
        }
        if (!settings.paused() && hitsStopLoss(book.pnl(), settings.allocation(), settings.stopLossPercent())) {
            throw new InvalidCopyTradeException("This copy has already lost more than its stop-loss; lower or clear the stop-loss to resume");
        }

        subscription.setAllocation(settings.allocation());
        subscription.setMaxPerTrade(settings.maxPerTrade());
        subscription.setStopLossPercent(settings.stopLossPercent());
        subscription.setSellOnStopLoss(settings.sellOnStopLoss());
        if (!settings.paused()) {
            subscription.setPausedAt(null);
            subscription.setPauseReason(null);
        } else if (!subscription.isPaused()) {
            subscription.setPausedAt(clock.instant());
            subscription.setPauseReason("USER");
        }
        if (copyTradingMapper.updateSettings(subscription) == 0) {
            throw new ResourceNotFoundException("Copy subscription", subscriptionId);
        }
        return withPerformance(copyTradingMapper.findSubscriptionById(subscriptionId));
    }

    private static void validate(CopySettings settings) {
        if (settings.allocation() == null || settings.allocation().signum() <= 0) {
            throw new InvalidCopyTradeException("allocation must be greater than 0");
        }
        if (settings.maxPerTrade() != null && settings.maxPerTrade().signum() <= 0) {
            throw new InvalidCopyTradeException("maxPerTrade must be greater than 0");
        }
        BigDecimal stopLoss = settings.stopLossPercent();
        if (stopLoss != null && (stopLoss.signum() <= 0 || stopLoss.compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw new InvalidCopyTradeException("stopLossPercent must be greater than 0 and at most 100");
        }
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
        int instrumentId = leaderOrder.getInstrument().getInstrumentId();
        CopyBook book = bookFor(subscription.getSubscriptionId());
        BigDecimal quantity;
        if (leaderOrder.isBuy()) {
            if (subscription.isPaused()) {
                logger.info("Copy {} is paused, order {} not copied", subscription.getSubscriptionId(), leaderOrder.getOrderId());
                return;
            }
            // What the trader's order is priced at: the limit if it has one, else its fill or placement price.
            BigDecimal price = leaderOrder.isLimit() ? leaderOrder.getLimitPrice() : leaderOrder.getPrice();
            quantity = copiedBuyQuantity(leaderOrder.getQuantity(), subscription.getAllocation(), trader.getEquity(),
                    price, subscription.getMaxPerTrade(), subscription.getAllocation().subtract(book.committed()));
        } else {
            // Only shares this copy bought, and never more than the follower still holds.
            BigDecimal sellable = book.sellable(instrumentId)
                    .min(heldQuantity(subscription.getFollowerAccountId(), instrumentId));
            BigDecimal leaderHeld = heldQuantity(trader.getAccountId(), instrumentId);
            // A filled sell has already come off the trader's holding.
            BigDecimal leaderBefore = "COMPLETE".equals(leaderOrder.getStatus())
                    ? leaderHeld.add(leaderOrder.getQuantity())
                    : leaderHeld;
            quantity = copiedSellQuantity(sellable, leaderOrder.getQuantity(), leaderBefore);
        }
        if (quantity.signum() <= 0) {
            logger.info("Order {} not copied to copy {}: nothing to {}", leaderOrder.getOrderId(),
                    subscription.getSubscriptionId(), leaderOrder.isBuy() ? "buy within its limits" : "sell");
            return;
        }
        OrderResult result = orderService.placeOrder(subscription.getFollowerAccountId(), instrumentId,
                leaderOrder.getSide(), quantity, leaderOrder.getOrderType(), leaderOrder.getLimitPrice(),
                leaderOrder.getTimeInForce());
        copyTradingMapper.insertCopyTrade(result.order().getOrderId(), leaderOrder.getOrderId(),
                subscription.getSubscriptionId());
        logger.info("Copied order {} to account {} as order {} ({})", leaderOrder.getOrderId(),
                subscription.getFollowerAccountId(), result.order().getOrderId(), result.order().getStatus());
    }

    /**
     * Shares a copy buys: the trader's order scaled by allocation / the trader's
     * equity, then cut so it costs no more than maxPerTrade (when set) and what
     * is left of the allocation.
     *
     * @param price      what one share is expected to cost, or null if unknown (no cost caps applied)
     * @param budgetLeft allocation minus what the copy already holds at cost and has pending
     */
    static BigDecimal copiedBuyQuantity(BigDecimal leaderQuantity, BigDecimal allocation, BigDecimal leaderEquity,
                                        BigDecimal price, BigDecimal maxPerTrade, BigDecimal budgetLeft) {
        if (leaderEquity == null || leaderEquity.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal quantity = leaderQuantity.multiply(allocation).divide(leaderEquity, 8, RoundingMode.DOWN);
        if (price != null && price.signum() > 0) {
            BigDecimal spend = budgetLeft.max(BigDecimal.ZERO);
            if (maxPerTrade != null) {
                spend = spend.min(maxPerTrade);
            }
            quantity = quantity.min(spend.divide(price, 8, RoundingMode.DOWN));
        }
        return quantity.setScale(QUANTITY_SCALE, RoundingMode.DOWN);
    }

    /**
     * Shares a copy sells: the same share of its copied position as the trader
     * sold of theirs, or all of it when the trader closed the position.
     *
     * @param sellable     copied shares the copy can sell
     * @param leaderBefore the trader's holding before this sell
     */
    static BigDecimal copiedSellQuantity(BigDecimal sellable, BigDecimal leaderSold, BigDecimal leaderBefore) {
        if (sellable.signum() <= 0 || leaderBefore.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        if (leaderSold.compareTo(leaderBefore) >= 0) {
            return sellable;
        }
        return sellable.multiply(leaderSold).divide(leaderBefore, QUANTITY_SCALE, RoundingMode.DOWN);
    }

    /** Whether a copy's profit or loss has reached its stop-loss; never without a stop-loss. */
    static boolean hitsStopLoss(BigDecimal pnl, BigDecimal allocation, BigDecimal stopLossPercent) {
        if (stopLossPercent == null || pnl.signum() >= 0) {
            return false;
        }
        BigDecimal limit = allocation.multiply(stopLossPercent).divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
        return pnl.negate().compareTo(limit) >= 0;
    }

    /**
     * Pauses each copy whose loss has reached its stop-loss and, if the follower
     * asked for it, sells the copy's shares at market. Run by CopyStopLossProcessor.
     * Each copy, and each sell, is its own transaction.
     */
    public void checkStopLosses() {
        for (CopySubscription subscription : copyTradingMapper.findStopLossWatched()) {
            try {
                CopyBook book = bookFor(subscription.getSubscriptionId());
                if (!hitsStopLoss(book.pnl(), subscription.getAllocation(), subscription.getStopLossPercent())) {
                    continue;
                }
                if (copyTradingMapper.pauseForStopLoss(subscription.getSubscriptionId(), clock.instant()) == 0) {
                    continue;
                }
                logger.info("Copy {} of account {} hit its {}% stop-loss (P/L {}), paused", subscription.getSubscriptionId(),
                        subscription.getFollowerAccountId(), subscription.getStopLossPercent(),
                        book.pnl().setScale(2, RoundingMode.HALF_UP));
                if (subscription.isSellOnStopLoss()) {
                    sellCopiedPositions(subscription, book);
                }
            } catch (RuntimeException e) {
                logger.warn("Could not check the stop-loss of copy {}", subscription.getSubscriptionId(), e);
            }
        }
    }

    private void sellCopiedPositions(CopySubscription subscription, CopyBook book) {
        int accountId = subscription.getFollowerAccountId();
        book.sellablePositions().forEach((instrumentId, sellable) -> {
            BigDecimal quantity = sellable.min(heldQuantity(accountId, instrumentId));
            if (quantity.signum() <= 0) {
                return;
            }
            try {
                transactionTemplate.executeWithoutResult(status -> {
                    OrderResult result = orderService.placeOrder(accountId, instrumentId, "SELL", quantity,
                            "MARKET", null, "DAY");
                    copyTradingMapper.insertCopyTrade(result.order().getOrderId(), null, subscription.getSubscriptionId());
                    logger.info("Stop-loss of copy {} sold {} of instrument {} as order {} ({})",
                            subscription.getSubscriptionId(), quantity, instrumentId, result.order().getOrderId(),
                            result.order().getStatus());
                });
            } catch (RuntimeException e) {
                logger.warn("Stop-loss of copy {} could not sell instrument {}", subscription.getSubscriptionId(),
                        instrumentId, e);
            }
        });
    }

    private CopyBook bookFor(int subscriptionId) {
        return CopyBook.of(copyTradingMapper.findLedger(subscriptionId));
    }

    private CopySubscription withPerformance(CopySubscription subscription) {
        CopyBook book = bookFor(subscription.getSubscriptionId());
        subscription.setPerformance(
                book.invested().setScale(2, RoundingMode.HALF_UP),
                book.marketValue().setScale(2, RoundingMode.HALF_UP),
                book.pnl().setScale(2, RoundingMode.HALF_UP),
                subscription.getAllocation().subtract(book.committed()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        return subscription;
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

    /** Performance from the trader's filled orders (oldest first) and their daily equity curve. */
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
        BigDecimal equity = trader.getEquity() == null ? BigDecimal.ZERO : trader.getEquity();
        BigDecimal pnl = start == null ? null : equity.subtract(start).setScale(2, RoundingMode.HALF_UP);
        BigDecimal roi = start == null || start.signum() <= 0
                ? null
                : equity.subtract(start).multiply(BigDecimal.valueOf(100)).divide(start, 2, RoundingMode.HALF_UP);
        BigDecimal successRate = closed == 0
                ? null
                : BigDecimal.valueOf(wins * 100L).divide(BigDecimal.valueOf(closed), 1, RoundingMode.HALF_UP);
        BigDecimal aum = equity.add(trader.getCopierFunds()).setScale(2, RoundingMode.HALF_UP);

        List<PortfolioValuePoint> curve = equityCurve(trader);
        List<Double> values = curve.stream().map(p -> p.totalValue().doubleValue()).toList();
        return new CopyTraderSummary(trader, pnl, roi, maxDrawdown(values), sharpeRatio(values), aum, successRate,
                closed, filled.size(), curve);
    }

    /**
     * Daily cash plus holdings since the trader started, from recorded prices.
     * The last point is today's equity at the latest prices, so it matches the
     * equity shown everywhere else.
     */
    private List<PortfolioValuePoint> equityCurve(CopyTrader trader) {
        Instant since = trader.getCreatedAt() == null ? Instant.EPOCH : trader.getCreatedAt().minus(1, ChronoUnit.DAYS);
        List<PortfolioValuePoint> curve = new ArrayList<>(
                portfolioHistoryService.valueHistory(trader.getAccountId(), PriceRange.ONE_YEAR).stream()
                        .filter(p -> !p.at().isBefore(since))
                        .toList());
        if (!curve.isEmpty()) {
            curve.remove(curve.size() - 1);
        }
        BigDecimal cash = accountService.findById(trader.getAccountId()).getCashBalance();
        BigDecimal equity = trader.getEquity() == null ? cash : trader.getEquity();
        curve.add(new PortfolioValuePoint(clock.instant(), cash.setScale(2, RoundingMode.HALF_UP),
                equity.subtract(cash).setScale(2, RoundingMode.HALF_UP)));
        return curve;
    }

    /** Largest fall from a running peak, in percent. 0 for a curve that never fell. */
    static BigDecimal maxDrawdown(List<Double> values) {
        double peak = 0;
        double worst = 0;
        for (double value : values) {
            peak = Math.max(peak, value);
            if (peak > 0) {
                worst = Math.max(worst, (peak - value) / peak);
            }
        }
        return BigDecimal.valueOf(worst * 100).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Mean daily return over its standard deviation, scaled to a year, with a
     * risk-free rate of 0. Null with too few points or a flat curve.
     */
    static BigDecimal sharpeRatio(List<Double> values) {
        List<Double> returns = new ArrayList<>();
        for (int i = 1; i < values.size(); i++) {
            if (values.get(i - 1) > 0) {
                returns.add(values.get(i) / values.get(i - 1) - 1);
            }
        }
        if (returns.size() < MIN_SHARPE_RETURNS) {
            return null;
        }
        double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = returns.stream().mapToDouble(r -> (r - mean) * (r - mean)).sum() / (returns.size() - 1);
        double deviation = Math.sqrt(variance);
        if (deviation == 0) {
            return null;
        }
        return BigDecimal.valueOf(mean / deviation * Math.sqrt(PERIODS_PER_YEAR)).setScale(2, RoundingMode.HALF_UP);
    }
}
