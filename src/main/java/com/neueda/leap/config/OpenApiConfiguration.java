package com.neueda.leap.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI/Swagger Configuration for Leap Frogs Trading API
 * 
 * Configures the API documentation with metadata, servers, and security schemes.
 * Access Swagger UI at: http://localhost:8081/api/swagger-ui.html
 * Access OpenAPI JSON at: http://localhost:8081/api/v3/api-docs
 */
@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "Leap Frogs Trading API",
        version = "0.1.0",
        description = "A comprehensive REST API for trading operations including order management, portfolio tracking, and market data",
        contact = @Contact(
            name = "Leap Frogs Team",
            email = "support@leapfrogs.dev"
        ),
        license = @License(
            name = "MIT License",
            url = "https://opensource.org/licenses/MIT"
        )
    ),
    servers = {
        @Server(
            url = "http://localhost:8081/api",
            description = "Development Server"
        ),
        @Server(
            url = "http://localhost:8081",
            description = "Local Server (root)"
        )
    }
)
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    description = "JWT authentication (coming soon)"
)
public class OpenApiConfiguration {
    // This configuration class enables OpenAPI documentation generation
    // All @RestController classes will automatically be included in the spec
}
