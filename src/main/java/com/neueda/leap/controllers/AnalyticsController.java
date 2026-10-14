package com.neueda.leap.controllers;

import com.neueda.leap.services.AnalyticsService;
import com.neueda.leap.services.AnalyticsService.Interval;
import com.neueda.leap.services.domain.Analytics.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Read-only trading activity reports for the commercial analyst (Priya's dashboard).
 * Served from the reporting database, so figures are as fresh as the last ETL run (see dataAsOf).
 *
 * All endpoints take optional from/to dates (inclusive, yyyy-MM-dd) and an optional symbol.
 */
@RestController
@RequestMapping("/analytics")
@CrossOrigin(origins = "*")
@Tag(name = "Analytics", description = "Aggregated trading activity for reporting (read-only)")
@ApiResponses(value = {
    @ApiResponse(responseCode = "400", description = "Invalid date range, symbol or option"),
    @ApiResponse(responseCode = "503", description = "Reporting database unavailable")
})
public class AnalyticsController {

    private static final Pattern SYMBOL = Pattern.compile("[A-Za-z0-9.\\-=^]{1,20}");
    private static final int MAX_LIMIT = 100;

    private final AnalyticsService analytics;

    public AnalyticsController(AnalyticsService analytics) {
        this.analytics = analytics;
    }

    /** GET /api/analytics/summary?from=2026-07-01&to=2026-09-30 */
    @GetMapping("/summary")
    @Operation(summary = "Headline figures", description = "Trades, value traded, buy/sell split, active clients and when the data was last refreshed")
    public Summary summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol) {
        return analytics.summary(filter(from, to, symbol));
    }

    /** GET /api/analytics/volume?interval=week */
    @GetMapping("/volume")
    @Operation(summary = "Value traded over time", description = "Trades and value traded per day, week or month (only periods with trades are returned)")
    public List<VolumePoint> volume(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(defaultValue = "day") @Parameter(description = "day, week or month") String interval) {
        return analytics.volume(filter(from, to, symbol), interval(interval));
    }

    /** GET /api/analytics/instruments?limit=10 */
    @GetMapping("/instruments")
    @Operation(summary = "Most traded instruments", description = "Instruments ranked by value traded")
    public List<InstrumentActivity> instruments(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol,
            @RequestParam(defaultValue = "10") @Parameter(description = "1 to 100") int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw badRequest("limit must be 1 to " + MAX_LIMIT);
        }
        return analytics.instruments(filter(from, to, symbol), limit);
    }

    /** GET /api/analytics/markets */
    @GetMapping("/markets")
    @Operation(summary = "Activity by exchange", description = "Trades and value traded per exchange (US, LSE, NSE, crypto, FX)")
    public List<MarketActivity> markets(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol) {
        return analytics.markets(filter(from, to, symbol));
    }

    /** GET /api/analytics/clients */
    @GetMapping("/clients")
    @Operation(summary = "Client activity per month", description = "Active clients, trades and average trades per client, by month")
    public List<ClientActivity> clients(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String symbol) {
        return analytics.clients(filter(from, to, symbol));
    }

    private static Filter filter(LocalDate from, LocalDate to, String symbol) {
        if (from != null && to != null && from.isAfter(to)) {
            throw badRequest("from must be on or before to");
        }
        String cleaned = symbol == null || symbol.isBlank() ? null : symbol.strip().toUpperCase(Locale.ROOT);
        if (cleaned != null && !SYMBOL.matcher(cleaned).matches()) {
            throw badRequest("'" + symbol + "' is not a valid symbol");
        }
        return new Filter(from, to, cleaned);
    }

    private static Interval interval(String value) {
        return Arrays.stream(Interval.values())
                .filter(i -> i.name().equalsIgnoreCase(value.strip()))
                .findFirst()
                .orElseThrow(() -> badRequest("interval must be day, week or month"));
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
