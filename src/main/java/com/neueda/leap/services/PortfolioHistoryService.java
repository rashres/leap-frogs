package com.neueda.leap.services;

import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.mappers.PriceHistoryMapper;
import com.neueda.leap.services.domain.Holding;
import com.neueda.leap.services.domain.Order;
import com.neueda.leap.services.domain.PortfolioValuePoint;
import com.neueda.leap.services.domain.PricePoint;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

/**
 * An account's value over time, worked out from data already stored: today's
 * cash and holdings, filled orders (transactions) and recorded prices
 * (instrument_price). Nothing is written.
 *
 * Starting from today's cash and holdings, every filled order placed after the
 * start of the range is undone, then replayed forwards point by point. So the
 * last point always matches the account's current cash and holdings.
 */
@Service
public class PortfolioHistoryService {

    /** How far before the range to look for a price to carry forward (weekends, holidays). */
    private static final Duration PRICE_LOOKBACK = Duration.ofDays(10);

    private final AccountService accountService;
    private final HoldingService holdingService;
    private final OrderMapper orderMapper;
    private final PriceHistoryMapper priceHistoryMapper;

    public PortfolioHistoryService(AccountService accountService, HoldingService holdingService,
                                   OrderMapper orderMapper, PriceHistoryMapper priceHistoryMapper) {
        this.accountService = accountService;
        this.holdingService = holdingService;
        this.orderMapper = orderMapper;
        this.priceHistoryMapper = priceHistoryMapper;
    }

    public List<PortfolioValuePoint> valueHistory(int accountId, PriceRange range) {
        BigDecimal cash = accountService.findById(accountId).getCashBalance();
        Map<Integer, BigDecimal> quantities = new HashMap<>();
        for (Holding holding : holdingService.findByAccountId(accountId)) {
            quantities.merge(holding.getInstrument().getInstrumentId(), holding.getQuantity(), BigDecimal::add);
        }

        Instant end = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        Instant start = end.minus(range.span());

        List<Order> inRange = orderMapper.findByAccountId(accountId).stream()
                .filter(o -> "COMPLETE".equals(o.getStatus()) && o.getPlacedTime().isAfter(start))
                .sorted(Comparator.comparing(Order::getPlacedTime).thenComparing(Order::getOrderId))
                .toList();
        for (Order order : inRange) {
            cash = cash.subtract(cashChange(order));
            quantities.merge(instrumentId(order), quantityChange(order).negate(), BigDecimal::add);
        }

        Map<Integer, NavigableMap<Instant, BigDecimal>> prices = new HashMap<>();
        for (Integer instrumentId : quantities.keySet()) {
            NavigableMap<Instant, BigDecimal> series = new TreeMap<>();
            for (PricePoint p : priceHistoryMapper.findSince(instrumentId, start.minus(PRICE_LOOKBACK), range.bucket())) {
                series.put(p.getObservedAt(), p.getPrice());
            }
            prices.put(instrumentId, series);
        }

        List<PortfolioValuePoint> points = new ArrayList<>();
        int next = 0;
        for (Instant at = start; !at.isAfter(end); at = at.plus(range.step())) {
            // The last point takes every order, including ones placed since `end` was rounded down.
            boolean last = at.equals(end);
            while (next < inRange.size() && (last || !inRange.get(next).getPlacedTime().isAfter(at))) {
                Order order = inRange.get(next++);
                cash = cash.add(cashChange(order));
                quantities.merge(instrumentId(order), quantityChange(order), BigDecimal::add);
            }
            points.add(new PortfolioValuePoint(at, scale(cash), scale(holdingsValue(quantities, prices, at))));
        }
        return points;
    }

    private static int instrumentId(Order order) {
        return order.getInstrument().getInstrumentId();
    }

    /** A buy takes cash out, a sell puts it back. */
    private static BigDecimal cashChange(Order order) {
        return "BUY".equals(order.getSide()) ? order.getValue().negate() : order.getValue();
    }

    private static BigDecimal quantityChange(Order order) {
        return "BUY".equals(order.getSide()) ? order.getQuantity() : order.getQuantity().negate();
    }

    /**
     * Each holding at the latest recorded price at or before `at`; before an
     * instrument's first recorded price, its earliest one. A holding with no
     * recorded price at all counts as zero, as does a negative quantity (seed
     * data can sell before it buys; the API rejects that).
     */
    private static BigDecimal holdingsValue(Map<Integer, BigDecimal> quantities,
                                            Map<Integer, NavigableMap<Instant, BigDecimal>> prices, Instant at) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Integer, BigDecimal> holding : quantities.entrySet()) {
            NavigableMap<Instant, BigDecimal> series = prices.get(holding.getKey());
            if (series.isEmpty() || holding.getValue().signum() <= 0) {
                continue;
            }
            Map.Entry<Instant, BigDecimal> price = series.floorEntry(at);
            total = total.add(holding.getValue().multiply(price != null ? price.getValue() : series.firstEntry().getValue()));
        }
        return total;
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
