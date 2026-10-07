package com.neueda.leap.services;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Chart ranges for GET /api/instruments/{id}/prices and
 * GET /api/accounts/{id}/value-history. Each range is read at a step size that
 * keeps a chart to a few hundred points at most.
 */
public enum PriceRange {
    ONE_DAY("1D", Duration.ofDays(1), Duration.ofMinutes(5)),
    ONE_WEEK("1W", Duration.ofDays(7), Duration.ofMinutes(30)),
    ONE_MONTH("1M", Duration.ofDays(30), Duration.ofHours(4)),
    THREE_MONTHS("3M", Duration.ofDays(90), Duration.ofDays(1)),
    ONE_YEAR("1Y", Duration.ofDays(365), Duration.ofDays(1));

    private final String code;
    private final Duration span;
    private final Duration step;

    PriceRange(String code, Duration span, Duration step) {
        this.code = code;
        this.span = span;
        this.step = step;
    }

    public String code() {
        return code;
    }

    public Duration span() {
        return span;
    }

    public Duration step() {
        return step;
    }

    /** The step as a PostgreSQL interval literal, passed to date_bin(). */
    public String bucket() {
        return step.toMinutes() + " minutes";
    }

    public static Optional<PriceRange> fromCode(String code) {
        return Arrays.stream(values()).filter(r -> r.code.equalsIgnoreCase(code)).findFirst();
    }

    public static String codes() {
        return String.join(", ", Arrays.stream(values()).map(PriceRange::code).toList());
    }
}
