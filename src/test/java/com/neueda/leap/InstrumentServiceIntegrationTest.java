package com.neueda.leap;

import com.neueda.leap.services.InstrumentService;
import com.neueda.leap.services.ResourceNotFoundException;
import com.neueda.leap.services.domain.Instrument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for InstrumentService with real database.
 *
 * Verifies that instruments are correctly retrieved from the database.
 */
@SpringBootTest
@DisplayName("InstrumentService Database Integration Tests")
class InstrumentServiceIntegrationTest {

    @Autowired
    private InstrumentService instrumentService;

    @Test
    @DisplayName("findAll retrieves all instruments from database")
    void findAllRetrievesInstrumentsFromDatabase() {
        // Act
        List<Instrument> instruments = instrumentService.findAll();

        // Assert
        assertNotNull(instruments);
        assertFalse(instruments.isEmpty(), "Should have instruments in database");
        
        // Verify sample instruments exist
        assertTrue(instruments.stream().anyMatch(i -> "AAPL".equals(i.getSymbol())),
                "Database should contain AAPL");
    }

    @Test
    @DisplayName("findById retrieves specific instrument from database")
    void findByIdRetrievesInstrumentFromDatabase() {
        // Act
        Instrument instrument = instrumentService.findById(1); // AAPL

        // Assert
        assertNotNull(instrument);
        assertEquals(1, instrument.getInstrumentId());
        assertEquals("AAPL", instrument.getSymbol());
        assertNotNull(instrument.getLastPrice(), "Instrument should have last_price from price_fetcher");
    }

    @Test
    @DisplayName("findById throws exception for non-existent instrument")
    void findByIdThrowsExceptionForInvalidId() {
        // Act & Assert
        assertThrows(ResourceNotFoundException.class, 
                () -> instrumentService.findById(99999),
                "Should throw exception for non-existent instrument");
    }

    @Test
    @DisplayName("instruments have market prices fetched by price_fetcher")
    void instrumentsHaveMarketPrices() {
        // Act
        Instrument aapl = instrumentService.findById(1);
        Instrument msft = instrumentService.findById(2);

        // Assert
        assertNotNull(aapl.getLastPrice(), "AAPL should have last_price");
        assertNotNull(msft.getLastPrice(), "MSFT should have last_price");
        
        assertTrue(aapl.getLastPrice().signum() > 0, "Prices should be positive");
        assertTrue(msft.getLastPrice().signum() > 0, "Prices should be positive");
    }
}
