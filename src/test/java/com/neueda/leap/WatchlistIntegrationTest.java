package com.neueda.leap;

import com.neueda.leap.services.InvalidWatchlistException;
import com.neueda.leap.services.ResourceNotFoundException;
import com.neueda.leap.services.WatchlistService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Watchlist against the real database. Uses account 1 and instruments 1-5
 * (AAPL ... TSLA); every test rolls back.
 */
@SpringBootTest
@Transactional
@DisplayName("Watchlist stored in the database")
class WatchlistIntegrationTest {

    private static final int ACCOUNT = 1;

    @Autowired
    private WatchlistService watchlistService;

    @Test
    @DisplayName("saving a list stores it in that order")
    void replaceKeepsOrder() {
        assertEquals(List.of(3, 1, 5), watchlistService.replace(ACCOUNT, List.of(3, 1, 5)));
        assertEquals(List.of(3, 1, 5), watchlistService.findInstrumentIds(ACCOUNT));
    }

    @Test
    @DisplayName("saving again adds, removes and reorders")
    void replaceAgain() {
        watchlistService.replace(ACCOUNT, List.of(1, 2, 3));

        assertEquals(List.of(4, 1), watchlistService.replace(ACCOUNT, List.of(4, 1)));
    }

    @Test
    @DisplayName("an empty list clears the watchlist")
    void clear() {
        watchlistService.replace(ACCOUNT, List.of(1, 2));

        assertEquals(List.of(), watchlistService.replace(ACCOUNT, List.of()));
    }

    @Test
    @DisplayName("each account has its own list")
    void perAccount() {
        watchlistService.replace(ACCOUNT, List.of(1));
        watchlistService.replace(2, List.of(2, 3));

        assertEquals(List.of(1), watchlistService.findInstrumentIds(ACCOUNT));
        assertEquals(List.of(2, 3), watchlistService.findInstrumentIds(2));
    }

    @Test
    @DisplayName("a repeated instrument, unknown instrument or unknown account is refused")
    void invalid() {
        assertThrows(InvalidWatchlistException.class, () -> watchlistService.replace(ACCOUNT, List.of(1, 1)));
        assertThrows(ResourceNotFoundException.class, () -> watchlistService.replace(ACCOUNT, List.of(999999)));
        assertThrows(ResourceNotFoundException.class, () -> watchlistService.findInstrumentIds(999999));
    }
}
