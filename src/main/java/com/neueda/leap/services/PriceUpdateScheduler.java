package com.neueda.leap.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.neueda.leap.mappers.InstrumentMapper;
import com.neueda.leap.mappers.PriceHistoryMapper;
import com.neueda.leap.services.domain.Instrument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps instrument prices live while the API runs.
 *
 * Every few seconds (price.update.interval.ms, 3000 by default) it asks Yahoo's
 * spark endpoint for every instrument at once, 20 symbols per request, and
 * writes the price to instrument.last_price plus one instrument_price row per
 * minute. Prices are stored in USD: LSE quotes in pence (GBp) and NSE quotes in
 * rupees (INR) are converted with the <CCY>USD=X rates fetched in the same batch.
 *
 * An instrument with no history older than two days (a newly added one) gets a
 * year of daily closes and five days of 15-minute bars backfilled once, so its
 * charts are not empty. Same rules as etl/price_fetcher.py, which still works
 * for a one-off refresh without the API.
 *
 * A failed fetch keeps the previous prices; the next run tries again.
 */
@Component
public class PriceUpdateScheduler {

    private static final Logger logger = LoggerFactory.getLogger(PriceUpdateScheduler.class);

    /** Yahoo's spark endpoint refuses more than 20 symbols in one request. */
    private static final int BATCH = 20;
    /** instrument.last_price is NUMERIC(18,6). */
    private static final int PRICE_SCALE = 6;
    /** Without history older than this, an instrument is backfilled. */
    private static final Duration BACKFILL_IF_NEWER_THAN = Duration.ofDays(2);
    /** A backfill that failed (Yahoo busy, say) is tried again after this long. */
    private static final Duration BACKFILL_RETRY = Duration.ofMinutes(15);
    /** Yahoo's minor-unit currency codes: the major currency and how many make one. */
    private static final Map<String, String> MINOR_UNITS = Map.of("GBp", "GBP", "GBX", "GBP", "ZAc", "ZAR");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final InstrumentMapper instrumentMapper;
    private final PriceHistoryMapper priceHistoryMapper;
    private final YahooFinanceService yahoo;
    private final ObjectMapper json;
    private final Clock clock;

    /** Quote currency per symbol, learned from earlier answers, so rates can be fetched in the same batch. */
    private final Map<String, String> currencyBySymbol = new ConcurrentHashMap<>();
    /** When each instrument's backfill was last tried. */
    private final Map<Integer, Instant> backfillTried = new ConcurrentHashMap<>();
    /** Instruments already known to have enough history; not checked again while the API runs. */
    private final Set<Integer> hasHistory = ConcurrentHashMap.newKeySet();

    @Value("${price.update.enabled:true}")
    private boolean priceUpdateEnabled;

    public PriceUpdateScheduler(InstrumentMapper instrumentMapper, PriceHistoryMapper priceHistoryMapper,
                                YahooFinanceService yahoo, ObjectMapper json) {
        this.instrumentMapper = instrumentMapper;
        this.priceHistoryMapper = priceHistoryMapper;
        this.yahoo = yahoo;
        this.json = json;
        this.clock = Clock.systemUTC();
    }

    /** A price from Yahoo in its own currency. */
    private record Quote(BigDecimal price, String currency) {}

    /** Waits the full interval after each run finishes, so runs never pile up. */
    @Scheduled(fixedDelayString = "${price.update.interval.ms:3000}")
    public void updatePrices() {
        if (!priceUpdateEnabled) {
            return;
        }
        try {
            refresh();
        } catch (Exception e) {
            // Never let one bad run stop the schedule.
            logger.error("Price update failed", e);
        }
    }

    void refresh() {
        List<Instrument> instruments = instrumentMapper.findAll();
        if (instruments.isEmpty()) {
            return;
        }

        Set<String> symbols = new LinkedHashSet<>();
        instruments.forEach(i -> symbols.add(i.getSymbol()));
        // Rates for every currency already seen ride along in the same requests.
        currencyBySymbol.values().forEach(c -> rateSymbol(c).ifPresent(symbols::add));

        Map<String, Quote> quotes = fetchQuotes(symbols);
        quotes.forEach((symbol, quote) -> currencyBySymbol.put(symbol, quote.currency()));

        // First run, or a new currency: fetch the missing rates now rather than wait a cycle.
        Set<String> missingRates = new LinkedHashSet<>();
        for (Quote quote : quotes.values()) {
            rateSymbol(quote.currency()).filter(s -> !quotes.containsKey(s)).ifPresent(missingRates::add);
        }
        if (!missingRates.isEmpty()) {
            quotes.putAll(fetchQuotes(missingRates));
        }

        Instant now = clock.instant();
        Instant minute = now.truncatedTo(ChronoUnit.MINUTES);
        int updated = 0;
        for (Instrument instrument : instruments) {
            Quote quote = quotes.get(instrument.getSymbol());
            if (quote == null) {
                continue;
            }
            BigDecimal factor = usdFactor(quote.currency(), quotes);
            if (factor == null) {
                logger.debug("No {}→USD rate yet for {}; keeping its previous price", quote.currency(), instrument.getSymbol());
                continue;
            }
            BigDecimal price = quote.price().multiply(factor).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
            if (price.signum() <= 0) {
                continue;
            }
            instrumentMapper.updateLastPrice(instrument.getInstrumentId(), price);
            priceHistoryMapper.upsert(instrument.getInstrumentId(), minute, price);
            backfillIfNew(instrument, factor, now);
            updated++;
        }
        logger.debug("Updated {}/{} instrument prices", updated, instruments.size());
    }

    /** Prices for the symbols, from as few spark requests as Yahoo allows. Symbols Yahoo does not answer are left out. */
    private Map<String, Quote> fetchQuotes(Set<String> symbols) {
        Map<String, Quote> quotes = new HashMap<>();
        List<String> all = new ArrayList<>(symbols);
        for (int start = 0; start < all.size(); start += BATCH) {
            List<String> batch = all.subList(start, Math.min(all.size(), start + BATCH));
            String list = String.join(",", batch.stream().map(s -> URLEncoder.encode(s, StandardCharsets.UTF_8)).toList());
            try {
                JsonNode results = json.readTree(yahoo.getUncached("/v7/finance/spark?symbols=" + list + "&range=1d&interval=1d"))
                        .path("spark").path("result");
                for (JsonNode result : results) {
                    JsonNode meta = result.path("response").path(0).path("meta");
                    JsonNode price = meta.path("regularMarketPrice");
                    if (price.isNumber()) {
                        quotes.put(result.path("symbol").asText(), new Quote(price.decimalValue(), meta.path("currency").asText("USD")));
                    }
                }
            } catch (ResponseStatusException e) {
                logger.warn("Yahoo prices unavailable for {} ({}); keeping previous prices", batch, e.getReason());
            } catch (Exception e) {
                logger.warn("Could not read Yahoo prices for {}: {}", batch, e.getMessage());
            }
        }
        return quotes;
    }

    /** "GBPUSD=X" for GBp or GBP; nothing for USD. */
    private static Optional<String> rateSymbol(String currency) {
        if (currency == null || currency.isBlank()) {
            return Optional.empty();
        }
        String major = MINOR_UNITS.getOrDefault(currency, currency).toUpperCase();
        return "USD".equals(major) ? Optional.empty() : Optional.of(major + "USD=X");
    }

    /** Multiplier from the currency to USD, or null when its rate has not been fetched. */
    private static BigDecimal usdFactor(String currency, Map<String, Quote> quotes) {
        Optional<String> rate = rateSymbol(currency);
        if (rate.isEmpty()) {
            return BigDecimal.ONE;
        }
        Quote quote = quotes.get(rate.get());
        if (quote == null || quote.price().signum() <= 0) {
            return null;
        }
        // Only reached with a non-blank currency (rateSymbol is empty otherwise).
        return MINOR_UNITS.containsKey(currency) ? quote.price().divide(HUNDRED) : quote.price();
    }

    /** A year of daily closes and five days of 15-minute bars for an instrument that has (almost) no history. */
    private void backfillIfNew(Instrument instrument, BigDecimal factor, Instant now) {
        int id = instrument.getInstrumentId();
        if (hasHistory.contains(id)) {
            return;
        }
        Instant tried = backfillTried.get(id);
        if (tried != null && tried.plus(BACKFILL_RETRY).isAfter(now)) {
            return;
        }
        Instant earliest = priceHistoryMapper.findEarliestObservedAt(id);
        if (earliest != null && earliest.isBefore(now.minus(BACKFILL_IF_NEWER_THAN))) {
            hasHistory.add(id);
            return;
        }
        backfillTried.put(id, now);
        int rows = 0;
        String symbol = URLEncoder.encode(instrument.getSymbol(), StandardCharsets.UTF_8);
        for (String query : List.of("?range=1y&interval=1d", "?range=5d&interval=15m")) {
            try {
                JsonNode result = json.readTree(yahoo.get("/v8/finance/chart/" + symbol + query)).path("chart").path("result").path(0);
                JsonNode stamps = result.path("timestamp");
                JsonNode closes = result.path("indicators").path("quote").path(0).path("close");
                for (int i = 0; i < stamps.size() && i < closes.size(); i++) {
                    if (!closes.get(i).isNumber()) {
                        continue;
                    }
                    BigDecimal price = closes.get(i).decimalValue().multiply(factor).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
                    if (price.signum() > 0) {
                        priceHistoryMapper.insertIfAbsent(id, Instant.ofEpochSecond(stamps.get(i).asLong()), price);
                        rows++;
                    }
                }
            } catch (Exception e) {
                logger.warn("Backfill {} {} failed: {}", instrument.getSymbol(), query, e.getMessage());
            }
        }
        if (rows > 0) {
            logger.info("Backfilled {} price bars for {}", rows, instrument.getSymbol());
        }
    }
}
