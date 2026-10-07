package com.neueda.leap.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Automatically updates instrument prices at regular intervals while the application is running.
 *
 * Executes the price_fetcher.py script via Docker to fetch latest market prices from yfinance
 * and update the database. Runs every 5 seconds (configurable via application.properties).
 *
 * Price updates stop automatically when the application shuts down.
 */
@Component
public class PriceUpdateScheduler {

    private static final Logger logger = LoggerFactory.getLogger(PriceUpdateScheduler.class);

    @Value("${price.update.enabled:true}")
    private boolean priceUpdateEnabled;

    /**
     * Scheduled method that runs at fixed intervals to update instrument prices.
     * The interval is configured via 'price.update.interval.ms' in application.properties.
     * Default: 5000 milliseconds (5 seconds)
     */
    @Scheduled(fixedRateString = "${price.update.interval.ms:5000}")
    public void updatePrices() {
        if (!priceUpdateEnabled) {
            return;
        }

        try {
            logger.debug("Starting price update cycle...");
            
            // Execute the price_fetcher.py script via Docker Compose
            boolean success = executePriceFetcher();
            
            if (success) {
                logger.debug("Price update completed successfully");
            } else {
                logger.warn("Price update completed with warnings or partial failures");
            }
        } catch (Exception e) {
            logger.error("Error updating instrument prices", e);
            // Don't throw - we want the scheduler to continue even if one update fails
        }
    }

    /**
     * Executes the price_fetcher.py script via docker-compose.
     * Assumes the application is running inside Docker with docker-compose.
     *
     * @return true if execution succeeded, false otherwise
     */
    private boolean executePriceFetcher() {
        try {
            // Build the command to run price_fetcher via docker-compose
            ProcessBuilder processBuilder = new ProcessBuilder(
                    "docker-compose", "run", "--rm", "price-fetcher"
            );
            
            // Redirect error stream to standard output for logging
            processBuilder.redirectErrorStream(true);
            
            // Start the process
            Process process = processBuilder.start();
            
            // Wait for completion with timeout (30 seconds should be enough for yfinance)
            boolean completed = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);
            
            if (!completed) {
                logger.warn("Price fetcher timed out after 30 seconds");
                process.destroyForcibly();
                return false;
            }
            
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                logger.warn("Price fetcher exited with code: {}", exitCode);
                return false;
            }
            
            return true;
        } catch (Exception e) {
            logger.error("Failed to execute price fetcher", e);
            return false;
        }
    }
}
