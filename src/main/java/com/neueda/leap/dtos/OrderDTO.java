package com.neueda.leap.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record OrderDTO(
        @NotNull(message = "Instrument is required")
        String instrument,

        @NotNull(message = "Side is required")
        String side,

        @Positive(message = "Quantity must be positive")
        double quantity,

        @Positive(message = "Price must be positive")
        double price
) {
}
