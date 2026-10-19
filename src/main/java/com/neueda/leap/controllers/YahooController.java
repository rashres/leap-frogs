package com.neueda.leap.controllers;

import com.neueda.leap.services.YahooFinanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Yahoo Finance search, chart and headline data, fetched server-side for the UI
 * (instrument search, news headlines and daily volume).
 *
 * Paths mirror Yahoo's own, so the UI reads Yahoo's responses unchanged. Only these
 * three endpoints and their known parameters are forwarded; this is not an open proxy.
 */
@RestController
@RequestMapping("/yahoo")
@CrossOrigin(origins = "*")
@Tag(name = "Yahoo Finance", description = "Server-side access to Yahoo Finance search and chart data (unofficial endpoints)")
public class YahooController {

    private static final Pattern SYMBOL = Pattern.compile("[A-Za-z0-9.\\-=^]{1,20}");
    private static final List<String> RANGES = List.of("1d", "5d", "1mo", "3mo", "6mo", "1y");
    private static final List<String> INTERVALS = List.of("1m", "5m", "15m", "30m", "1h", "1d", "1wk");
    private static final int MAX_QUERY_LENGTH = 100;

    private final YahooFinanceService yahoo;

    public YahooController(YahooFinanceService yahoo) {
        this.yahoo = yahoo;
    }

    /**
     * GET /api/yahoo/v1/finance/search?q=AAPL&quotesCount=8&newsCount=0
     */
    @GetMapping(value = "/v1/finance/search", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Search Yahoo Finance", description = "Instruments and/or news matching a term, as Yahoo returns them")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Yahoo's search response"),
        @ApiResponse(responseCode = "400", description = "Invalid parameters"),
        @ApiResponse(responseCode = "429", description = "Yahoo is rate-limiting"),
        @ApiResponse(responseCode = "502", description = "Yahoo failed or answered unexpectedly"),
        @ApiResponse(responseCode = "504", description = "Yahoo timed out")
    })
    public ResponseEntity<String> search(
            @RequestParam @Parameter(description = "Search term") String q,
            @RequestParam(defaultValue = "6") @Parameter(description = "0 to 20") int quotesCount,
            @RequestParam(defaultValue = "0") @Parameter(description = "0 to 50") int newsCount,
            @RequestParam(defaultValue = "false") boolean enableFuzzyQuery) {
        String term = q.strip();
        if (term.isEmpty() || term.length() > MAX_QUERY_LENGTH) {
            throw badRequest("q must be 1 to " + MAX_QUERY_LENGTH + " characters");
        }
        if (quotesCount < 0 || quotesCount > 20 || newsCount < 0 || newsCount > 50) {
            throw badRequest("quotesCount must be 0-20 and newsCount 0-50");
        }
        String path = "/v1/finance/search?q=" + encode(term)
                + "&quotesCount=" + quotesCount
                + "&newsCount=" + newsCount
                + "&enableFuzzyQuery=" + enableFuzzyQuery;
        return json(yahoo.get(path));
    }

    /**
     * GET /api/yahoo/v8/finance/chart/AAPL?range=1d&interval=1d
     */
    @GetMapping(value = "/v8/finance/chart/{symbol}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Yahoo Finance chart", description = "Price bars and quote metadata (including today's volume) for one Yahoo symbol")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Yahoo's chart response"),
        @ApiResponse(responseCode = "400", description = "Invalid symbol, range or interval"),
        @ApiResponse(responseCode = "404", description = "Unknown symbol"),
        @ApiResponse(responseCode = "429", description = "Yahoo is rate-limiting"),
        @ApiResponse(responseCode = "502", description = "Yahoo failed or answered unexpectedly"),
        @ApiResponse(responseCode = "504", description = "Yahoo timed out")
    })
    public ResponseEntity<String> chart(
            @PathVariable @Parameter(description = "Yahoo symbol, e.g. AAPL, VOD.L, BTC-USD, EURUSD=X") String symbol,
            @RequestParam(defaultValue = "1d") String range,
            @RequestParam(defaultValue = "1d") String interval) {
        if (!SYMBOL.matcher(symbol).matches()) {
            throw badRequest("'" + symbol + "' is not a valid symbol");
        }
        if (!RANGES.contains(range) || !INTERVALS.contains(interval)) {
            throw badRequest("range must be one of " + RANGES + " and interval one of " + INTERVALS);
        }
        String path = "/v8/finance/chart/" + encode(symbol) + "?range=" + range + "&interval=" + interval;
        return json("1m".equals(interval) ? yahoo.getLive(path) : yahoo.get(path));
    }

    /**
     * GET /api/yahoo/rss/2.0/headline?s=AAPL
     */
    @GetMapping(value = "/rss/2.0/headline", produces = MediaType.APPLICATION_XML_VALUE)
    @Operation(summary = "Yahoo Finance headline feed", description = "Recent headlines for one Yahoo symbol, as Yahoo's RSS (each with a one-line summary)")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Yahoo's RSS feed"),
        @ApiResponse(responseCode = "400", description = "Invalid symbol"),
        @ApiResponse(responseCode = "429", description = "Yahoo is rate-limiting"),
        @ApiResponse(responseCode = "502", description = "Yahoo failed or answered unexpectedly"),
        @ApiResponse(responseCode = "504", description = "Yahoo timed out")
    })
    public ResponseEntity<String> headlines(
            @RequestParam @Parameter(description = "Yahoo symbol, e.g. AAPL, VOD.L") String s) {
        if (!SYMBOL.matcher(s).matches()) {
            throw badRequest("'" + s + "' is not a valid symbol");
        }
        String body = yahoo.getXml("/rss/2.0/headline?s=" + encode(s) + "&region=US&lang=en-US");
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(body);
    }

    private static ResponseEntity<String> json(String body) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
