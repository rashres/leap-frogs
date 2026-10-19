package com.neueda.leap.controllers.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Sign up as a trader with a new trading account")
public record RegisterRequest(
        @NotBlank(message = "name is required")
        @Size(max = 100, message = "name must be at most 100 characters")
        @Schema(description = "Your name, shown on the account", example = "Sam Rivera")
        String name,

        @NotBlank(message = "email is required")
        @Email(message = "email must be a valid email address")
        @Size(max = 255, message = "email must be at most 255 characters")
        @Schema(description = "Email for the trading account; one account per email", example = "sam@example.com")
        String email,

        @NotBlank(message = "username is required")
        @Pattern(regexp = "^[A-Za-z0-9._-]{3,32}$",
                message = "username must be 3 to 32 letters, numbers, dots, dashes or underscores")
        @Schema(description = "Sign-in name; stored in lower case", example = "sam.rivera")
        String username,

        @NotBlank(message = "password is required")
        // BCrypt only uses the first 72 bytes.
        @Size(min = 8, max = 72, message = "password must be 8 to 72 characters")
        @Schema(description = "At least 8 characters", example = "correct-horse-battery")
        String password
) {}
