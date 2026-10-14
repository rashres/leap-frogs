package com.neueda.leap.services;

import com.neueda.leap.services.domain.Instrument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Map;

/**
 * When each market trades, keyed by the exchange name in the database. The
 * hours match ui/src/app/core/markets/sessions.ts; keep the two in step.
 * Public holidays are not modelled.
 *
 * An exchange this class does not know is treated as always open, so a new
 * exchange keeps trading the way every order did before trading hours existed.
 * Setting market.hours.enforced=false does the same for every exchange.
 */
@Component
public class MarketHours {

    /** How a market's day is laid out. */
    enum Market {
        /** Mon-Fri between open and close, local time. */
        EQUITIES_US(ZoneId.of("America/New_York"), LocalTime.of(9, 30), LocalTime.of(16, 0)),
        EQUITIES_UK(ZoneId.of("Europe/London"), LocalTime.of(8, 0), LocalTime.of(16, 30)),
        EQUITIES_INDIA(ZoneId.of("Asia/Kolkata"), LocalTime.of(9, 15), LocalTime.of(15, 30)),
        /** Sunday 22:00 to Friday 22:00 UTC without a break; each trading day ends at 22:00 UTC. */
        FX(ZoneOffset.UTC, LocalTime.of(22, 0), LocalTime.of(22, 0)),
        /** Never closes; each trading day ends at midnight UTC. */
        CRYPTO(ZoneOffset.UTC, LocalTime.MIDNIGHT, LocalTime.MIDNIGHT);

        final ZoneId zone;
        final LocalTime open;
        final LocalTime close;

        Market(ZoneId zone, LocalTime open, LocalTime close) {
            this.zone = zone;
            this.open = open;
            this.close = close;
        }
    }

    private static final Map<String, Market> EXCHANGE_MARKET = Map.ofEntries(
            Map.entry("nasdaq", Market.EQUITIES_US),
            Map.entry("nyse", Market.EQUITIES_US),
            Map.entry("amex", Market.EQUITIES_US),
            Map.entry("lse", Market.EQUITIES_UK),
            Map.entry("london stock exchange", Market.EQUITIES_UK),
            Map.entry("nse", Market.EQUITIES_INDIA),
            Map.entry("bse", Market.EQUITIES_INDIA),
            Map.entry("fx", Market.FX),
            Map.entry("forex", Market.FX),
            Map.entry("binance", Market.CRYPTO),
            Map.entry("coinbase", Market.CRYPTO),
            Map.entry("kraken", Market.CRYPTO));

    private final Clock clock;
    private final boolean enforced;

    public MarketHours(Clock clock, @Value("${market.hours.enforced:true}") boolean enforced) {
        this.clock = clock;
        this.enforced = enforced;
    }

    public Instant now() {
        return clock.instant();
    }

    public boolean isOpen(Instrument instrument, Instant at) {
        Market market = marketFor(instrument);
        if (market == null) {
            return true;
        }
        ZonedDateTime local = at.atZone(market.zone);
        DayOfWeek day = local.getDayOfWeek();
        LocalTime time = local.toLocalTime();
        return switch (market) {
            case CRYPTO -> true;
            case FX -> switch (day) {
                case SATURDAY -> false;
                case SUNDAY -> !time.isBefore(market.open);
                case FRIDAY -> time.isBefore(market.close);
                default -> true;
            };
            default -> isWeekday(day) && !time.isBefore(market.open) && time.isBefore(market.close);
        };
    }

    /**
     * The end of the trading day a DAY order placed at `at` belongs to: today's
     * close while the market is open or yet to open today, otherwise the close
     * of the next trading day. Null when trading hours are not enforced for this
     * instrument, so a DAY order there never expires.
     */
    public Instant sessionEnd(Instrument instrument, Instant at) {
        Market market = marketFor(instrument);
        if (market == null) {
            return null;
        }
        LocalDate date = at.atZone(market.zone).toLocalDate();
        // Two weekend days plus today is the furthest the next close can be.
        for (int i = 0; i < 4; i++, date = date.plusDays(1)) {
            LocalDate closeDate = market == Market.CRYPTO ? date.plusDays(1) : date;
            Instant close = closeDate.atTime(market.close).atZone(market.zone).toInstant();
            if (close.isAfter(at) && (market == Market.CRYPTO || isWeekday(date.getDayOfWeek()))) {
                return close;
            }
        }
        throw new IllegalStateException("No session close within 4 days for " + market);
    }

    private Market marketFor(Instrument instrument) {
        if (!enforced || instrument.getExchange() == null || instrument.getExchange().getName() == null) {
            return null;
        }
        return EXCHANGE_MARKET.get(instrument.getExchange().getName().trim().toLowerCase(Locale.ROOT));
    }

    private static boolean isWeekday(DayOfWeek day) {
        return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY;
    }
}
