package com.neueda.leap.controllers.dto;

import jakarta.validation.constraints.NotBlank;

public record FreezeRequest(
        @NotBlank(message = "reason is required") String reason
) {}
