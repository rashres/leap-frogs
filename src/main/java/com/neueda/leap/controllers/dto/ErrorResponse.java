package com.neueda.leap.controllers.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.Map;

@Schema(description = "Error returned by every endpoint when a request fails")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        @Schema(description = "When the error happened")
        Instant timestamp,

        @Schema(description = "HTTP status code", example = "404")
        int status,

        @Schema(description = "HTTP status reason", example = "Not Found")
        String error,

        @Schema(description = "What went wrong", example = "Account 9999 not found")
        String message,

        @Schema(description = "Request path", example = "/api/accounts/9999")
        String path,

        @Schema(description = "Per-field validation errors (only for invalid request bodies)",
                example = "{\"quantity\": \"Quantity must be positive\"}")
        Map<String, String> fieldErrors
) {
}
