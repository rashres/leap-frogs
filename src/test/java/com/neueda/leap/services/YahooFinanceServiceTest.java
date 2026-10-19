package com.neueda.leap.services;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * YahooFinanceService against a local stand-in for Yahoo: no network, no database.
 */
class YahooFinanceServiceTest {

    private HttpServer server;
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>("{\"ok\":1}");
    private final AtomicInteger delayMs = new AtomicInteger(0);
    private final MutableClock clock = new MutableClock();
    private YahooFinanceService yahoo;

    @BeforeEach
    void start() throws java.io.IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            calls.incrementAndGet();
            try {
                Thread.sleep(delayMs.get());
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        yahoo = create("http://127.0.0.1:" + server.getAddress().getPort(),
                Duration.ofMillis(500), Duration.ofSeconds(120), Duration.ofSeconds(3600));
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void returnsUpstreamJsonUnchanged() {
        body.set("{\"quotes\":[{\"symbol\":\"AAPL\"}]}");
        assertEquals("{\"quotes\":[{\"symbol\":\"AAPL\"}]}", yahoo.get("/v1/finance/search?q=AAPL"));
    }

    @Test
    void reusesFreshAnswersAndRefetchesAfterTtl() {
        yahoo.get("/x");
        yahoo.get("/x");
        assertEquals(1, calls.get());

        clock.advance(Duration.ofSeconds(121));
        yahoo.get("/x");
        assertEquals(2, calls.get());
    }

    @Test
    void liveAnswersExpireSooner() {
        YahooFinanceService live = new YahooFinanceService("http://127.0.0.1:" + server.getAddress().getPort(),
                Duration.ofMillis(500), Duration.ofSeconds(120), Duration.ofSeconds(10), Duration.ofSeconds(3600), clock);
        live.getLive("/chart");
        clock.advance(Duration.ofSeconds(5));
        live.getLive("/chart");
        assertEquals(1, calls.get());

        clock.advance(Duration.ofSeconds(6));
        live.getLive("/chart");
        assertEquals(2, calls.get());
    }

    @Test
    void servesRecentCopyWhenRateLimited() {
        body.set("{\"v\":1}");
        yahoo.get("/x");
        clock.advance(Duration.ofSeconds(200));
        status.set(429);
        assertEquals("{\"v\":1}", yahoo.get("/x"));
    }

    @Test
    void rateLimitWithoutCopyIs429() {
        status.set(429);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> yahoo.get("/x"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatusCode());
    }

    @Test
    void copyOlderThanStaleLimitIsNotServed() {
        yahoo.get("/x");
        clock.advance(Duration.ofSeconds(3601));
        status.set(500);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> yahoo.get("/x"));
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatusCode());
    }

    @Test
    void nonJsonAnswerIs502() {
        body.set("Too Many Requests");
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> yahoo.get("/x"));
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatusCode());
    }

    @Test
    void returnsRssUnchanged() {
        body.set("<?xml version=\"1.0\"?><rss><channel><item><title>Apple beats</title></item></channel></rss>");
        assertEquals(body.get(), yahoo.getXml("/rss/2.0/headline?s=AAPL"));
    }

    @Test
    void jsonWhereRssExpectedIs502() {
        body.set("{\"error\":\"not found\"}");
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> yahoo.getXml("/rss"));
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatusCode());
    }

    @Test
    void slowAnswerIs504() {
        delayMs.set(1500);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> yahoo.get("/x"));
        assertEquals(HttpStatus.GATEWAY_TIMEOUT, e.getStatusCode());
    }

    @Test
    void unreachableHostIs502() {
        YahooFinanceService down = create("http://127.0.0.1:1", Duration.ofMillis(500),
                Duration.ofSeconds(120), Duration.ofSeconds(3600));
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> down.get("/x"));
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatusCode());
    }

    private YahooFinanceService create(String baseUrl, Duration timeout, Duration fresh, Duration stale) {
        return new YahooFinanceService(baseUrl, timeout, fresh, stale, clock);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-08T12:00:00Z");

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }
}
