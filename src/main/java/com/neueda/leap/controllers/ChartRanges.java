package com.neueda.leap.controllers;

import com.neueda.leap.services.PriceRange;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Reads the ?range= query parameter shared by the chart endpoints. */
final class ChartRanges {

    private ChartRanges() {
    }

    static PriceRange parse(String code) {
        return PriceRange.fromCode(code).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "'" + code + "' is not a valid range; use one of " + PriceRange.codes()));
    }
}
