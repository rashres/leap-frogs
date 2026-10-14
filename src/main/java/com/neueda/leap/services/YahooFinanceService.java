package com.neueda.leap.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side access to Yahoo Finance's public web endpoints (search, chart and headline RSS).
 *
 * These endpoints are unofficial and undocumented: Yahoo can rate-limit (429),
 * change or withdraw them at any time. Responses are cached in memory, and when
 * Yahoo fails a recent cached answer is served instead of an error.
 */
@Service
public class YahooFinanceService {

    private static final Logger log = LoggerFactory.getLogger(YahooFinanceService.class);
    /** Yahoo answers 429 to requests without a browser-like User-Agent. */
    private static final String USER_AGENT = "Mozilla/5.0 (leap-frogs-api)";
    private static final int MAX_ENTRIES = 500;

    private record Entry(String body, Instant fetchedAt) {}

    private final HttpClient http;
    private final String baseUrl;
    private final Duration timeout;
    private final Duration fresh;
    private final Duration staleLimit;
    private final Clock clock;
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    @Autowired
    public YahooFinanceService(
            @Value("${yahoo.base-url:https://query2.finance.yahoo.com}") String baseUrl,
            @Value("${yahoo.timeout-ms:5000}") long timeoutMs,
            @Value("${yahoo.cache-ttl-seconds:120}") long cacheTtlSeconds,
            @Value("${yahoo.stale-limit-seconds:3600}") long staleLimitSeconds) {
        this(baseUrl, Duration.ofMillis(timeoutMs), Duration.ofSeconds(cacheTtlSeconds),
                Duration.ofSeconds(staleLimitSeconds), Clock.systemUTC());
    }

    YahooFinanceService(String baseUrl, Duration timeout, Duration fresh, Duration staleLimit, Clock clock) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.timeout = timeout;
        this.fresh = fresh;
        this.staleLimit = staleLimit;
        this.clock = clock;
        this.http = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * Returns Yahoo's JSON for a path and query built by the caller from validated input.
     *
     * @throws ResponseStatusException 429 when Yahoo is rate-limiting, 504 on timeout,
     *                                 502 for any other upstream failure, each only when no cached copy is recent enough
     */
    public String get(String pathAndQuery) {
        return get(pathAndQuery, false);
    }

    /** As {@link #get}, for Yahoo's RSS feeds, which answer XML instead of JSON. */
    public String getXml(String pathAndQuery) {
        return get(pathAndQuery, true);
    }

    private String get(String pathAndQuery, boolean xml) {
        Instant now = clock.instant();
        Entry cached = cache.get(pathAndQuery);
        if (cached != null && cached.fetchedAt().plus(fresh).isAfter(now)) {
            return cached.body();
        }
        try {
            String body = fetch(pathAndQuery, xml);
            if (cache.size() >= MAX_ENTRIES) {
                evictOldest();
            }
            cache.put(pathAndQuery, new Entry(body, now));
            return body;
        } catch (ResponseStatusException e) {
            if (cached != null && cached.fetchedAt().plus(staleLimit).isAfter(now)) {
                log.debug("Yahoo failed ({}); serving cached {}", e.getStatusCode(), pathAndQuery);
                return cached.body();
            }
            throw e;
        }
    }

    private String fetch(String pathAndQuery, boolean xml) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + pathAndQuery))
                .timeout(timeout)
                .header("User-Agent", USER_AGENT)
                .header("Accept", xml ? "application/xml" : "application/json")
                .GET()
                .build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            log.warn("Yahoo timed out: {}", pathAndQuery);
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Yahoo Finance did not answer in time");
        } catch (IOException e) {
            log.warn("Yahoo unreachable: {} ({})", pathAndQuery, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Yahoo Finance could not be reached");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Yahoo Finance request was interrupted");
        }

        int status = response.statusCode();
        if (status == 429) {
            log.warn("Yahoo is rate-limiting: {}", pathAndQuery);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Yahoo Finance is rate-limiting requests; try again shortly");
        }
        if (status == 404) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Yahoo Finance has no data for this request");
        }
        if (status < 200 || status >= 300 || !response.body().stripLeading().startsWith(xml ? "<" : "{")) {
            log.warn("Yahoo answered {} for {}", status, pathAndQuery);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Yahoo Finance returned an unexpected response (HTTP " + status + ")");
        }
        return response.body();
    }

    private void evictOldest() {
        cache.entrySet().stream()
                .min(Map.Entry.comparingByValue((a, b) -> a.fetchedAt().compareTo(b.fetchedAt())))
                .ifPresent(oldest -> cache.remove(oldest.getKey()));
    }
}
