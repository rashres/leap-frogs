package com.neueda.leap;

import com.neueda.leap.services.MarketHours;
import com.neueda.leap.services.domain.Exchange;
import com.neueda.leap.services.domain.Instrument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Trading hours per market. Pure domain logic - no database or Spring context.
 * 2026-10-14 is a Wednesday; New York is UTC-4 in October.
 */
@DisplayName("Market hours")
class MarketHoursTest {

    private static final MarketHours HOURS = new MarketHours(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), true);

    private static Instrument on(String exchangeName) {
        Exchange exchange = new Exchange();
        exchange.setName(exchangeName);
        Instrument instrument = new Instrument(1, "X", "X", 1);
        instrument.setExchange(exchange);
        return instrument;
    }

    private static Instant at(String iso) {
        return Instant.parse(iso);
    }

    @Test
    @DisplayName("US equities trade 09:30-16:00 New York, weekdays only")
    void usSession() {
        Instrument aapl = on("NASDAQ");
        assertFalse(HOURS.isOpen(aapl, at("2026-10-14T13:29:00Z")), "09:29 NY");
        assertTrue(HOURS.isOpen(aapl, at("2026-10-14T13:30:00Z")), "09:30 NY");
        assertTrue(HOURS.isOpen(aapl, at("2026-10-14T19:59:00Z")), "15:59 NY");
        assertFalse(HOURS.isOpen(aapl, at("2026-10-14T20:00:00Z")), "16:00 NY");
        assertFalse(HOURS.isOpen(aapl, at("2026-10-17T15:00:00Z")), "Saturday");
    }

    @Test
    @DisplayName("a DAY order belongs to today's session until it closes, then to the next weekday's")
    void usSessionEnd() {
        Instrument aapl = on("NASDAQ");
        Instant wednesdayClose = at("2026-10-14T20:00:00Z");
        assertEquals(wednesdayClose, HOURS.sessionEnd(aapl, at("2026-10-14T11:00:00Z")), "before the open");
        assertEquals(wednesdayClose, HOURS.sessionEnd(aapl, at("2026-10-14T15:00:00Z")), "during the session");
        assertEquals(at("2026-10-15T20:00:00Z"), HOURS.sessionEnd(aapl, at("2026-10-14T20:00:00Z")), "at the close");
        assertEquals(at("2026-10-19T20:00:00Z"), HOURS.sessionEnd(aapl, at("2026-10-16T21:00:00Z")), "Friday evening -> Monday");
        assertEquals(at("2026-10-19T20:00:00Z"), HOURS.sessionEnd(aapl, at("2026-10-18T12:00:00Z")), "Sunday -> Monday");
    }

    @Test
    @DisplayName("London and Mumbai use their own time zones")
    void ukAndIndia() {
        // London is UTC+1 in mid October (BST), Mumbai UTC+5:30.
        assertTrue(HOURS.isOpen(on("LSE"), at("2026-10-14T07:00:00Z")), "08:00 London");
        assertFalse(HOURS.isOpen(on("LSE"), at("2026-10-14T15:30:00Z")), "16:30 London");
        assertTrue(HOURS.isOpen(on("NSE"), at("2026-10-14T03:45:00Z")), "09:15 Mumbai");
        assertFalse(HOURS.isOpen(on("NSE"), at("2026-10-14T10:00:00Z")), "15:30 Mumbai");
    }

    @Test
    @DisplayName("FX trades Sunday 22:00 to Friday 22:00 UTC; its day ends at 22:00 UTC")
    void fx() {
        Instrument eurusd = on("FX");
        assertFalse(HOURS.isOpen(eurusd, at("2026-10-18T21:59:00Z")), "Sunday 21:59");
        assertTrue(HOURS.isOpen(eurusd, at("2026-10-18T22:00:00Z")), "Sunday 22:00");
        assertTrue(HOURS.isOpen(eurusd, at("2026-10-14T03:00:00Z")), "Wednesday night");
        assertFalse(HOURS.isOpen(eurusd, at("2026-10-16T22:00:00Z")), "Friday 22:00");
        assertEquals(at("2026-10-14T22:00:00Z"), HOURS.sessionEnd(eurusd, at("2026-10-14T03:00:00Z")));
        assertEquals(at("2026-10-19T22:00:00Z"), HOURS.sessionEnd(eurusd, at("2026-10-17T12:00:00Z")), "Saturday -> Monday");
    }

    @Test
    @DisplayName("crypto never closes; its day ends at midnight UTC")
    void crypto() {
        Instrument btc = on("Binance");
        assertTrue(HOURS.isOpen(btc, at("2026-10-17T03:00:00Z")), "Saturday night");
        assertEquals(at("2026-10-18T00:00:00Z"), HOURS.sessionEnd(btc, at("2026-10-17T03:00:00Z")));
    }

    @Test
    @DisplayName("an unknown exchange, or hours switched off, trades around the clock and never expires")
    void notEnforced() {
        assertTrue(HOURS.isOpen(on("Mystery Exchange"), at("2026-10-17T03:00:00Z")));
        assertNull(HOURS.sessionEnd(on("Mystery Exchange"), at("2026-10-17T03:00:00Z")));

        MarketHours off = new MarketHours(Clock.systemUTC(), false);
        assertTrue(off.isOpen(on("NASDAQ"), at("2026-10-17T03:00:00Z")), "Saturday, hours off");
        assertNull(off.sessionEnd(on("NASDAQ"), at("2026-10-17T03:00:00Z")));
    }
}
