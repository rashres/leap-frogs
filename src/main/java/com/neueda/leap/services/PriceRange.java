package com.neueda.leap.services;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Chart ranges for GET /api/instruments/{id}/prices. Each range is read at a
 * bucket size that keeps a chart to a few hundred points at most.
 */
public enum PriceRange {
    ONE_DAY("1D", Duration.ofDays(1), "5 minutes"),
    ONE_WEEK("1W", Duration.ofDays(7), "30 minutes"),
    ONE_MONTH("1M", Duration.ofDays(30), "4 hours"),
    THREE_MONTHS("3M", Duration.ofDays(90), "1 day"),
    ONE_YEAR("1Y", Duration.ofDays(365), "1 day");

    private final String code;
    private final Duration span;
    /** A PostgreSQL interval literal, passed to date_bin(). */
    private final String bucket;

    PriceRange(String code, Duration span, String bucket) {
        this.code = code;
        this.span = span;
        this.bucket = bucket;
    }

    public String code() {
        return code;
    }

    public Duration span() {
        return span;
    }

    public String bucket() {
        return bucket;
    }

    public static Optional<PriceRange> fromCode(String code) {
        return Arrays.stream(values()).filter(r -> r.code.equalsIgnoreCase(code)).findFirst();
    }

    public static String codes() {
        return String.join(", ", Arrays.stream(values()).map(PriceRange::code).toList());
    }
}
