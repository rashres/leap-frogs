package com.neueda.leap.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neueda.leap.mappers.InstrumentMapper;
import com.neueda.leap.mappers.PriceHistoryMapper;
import com.neueda.leap.services.domain.Instrument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The live price updater, with Yahoo and the database replaced by stand-ins. */
@DisplayName("PriceUpdateScheduler")
class PriceUpdateSchedulerTest {

    private InstrumentMapper instruments;
    private PriceHistoryMapper history;
    private YahooFinanceService yahoo;
    private PriceUpdateScheduler scheduler;

    @BeforeEach
    void setUp() {
        instruments = mock(InstrumentMapper.class);
        history = mock(PriceHistoryMapper.class);
        yahoo = mock(YahooFinanceService.class);
        scheduler = new PriceUpdateScheduler(instruments, history, yahoo, new ObjectMapper());
        // Every instrument already has old history, so no backfill requests.
        when(history.findEarliestObservedAt(anyInt())).thenReturn(Instant.parse("2020-01-01T00:00:00Z"));
    }

    private static String spark(String... results) {
        return "{\"spark\":{\"result\":[" + String.join(",", results) + "]}}";
    }

    private static String quote(String symbol, String currency, String price) {
        return "{\"symbol\":\"" + symbol + "\",\"response\":[{\"meta\":{\"currency\":\"" + currency
                + "\",\"regularMarketPrice\":" + price + "}}]}";
    }

    @Test
    @DisplayName("prices every instrument from one request, converting pence to USD")
    void pricesInUsd() {
        when(instruments.findAll()).thenReturn(List.of(
                new Instrument(1, "AAPL", "Apple", 1),
                new Instrument(7, "SHEL.L", "Shell", 3)));
        // First request: the instruments. Shell is in pence, so a second request fetches GBPUSD=X.
        when(yahoo.getUncached(contains("symbols=AAPL,SHEL.L&"))).thenReturn(spark(
                quote("AAPL", "USD", "345.5"), quote("SHEL.L", "GBp", "3946.0")));
        when(yahoo.getUncached(contains("symbols=GBPUSD%3DX&"))).thenReturn(spark(quote("GBPUSD=X", "USD", "1.25")));

        scheduler.refresh();

        verify(instruments).updateLastPrice(1, new BigDecimal("345.500000"));
        // 3946 pence × 1.25 / 100 = 49.325 USD
        verify(instruments).updateLastPrice(7, new BigDecimal("49.325000"));
        verify(history, times(2)).upsert(anyInt(), any(Instant.class), any(BigDecimal.class));
    }

    @Test
    @DisplayName("asks for the exchange rate in the same request once the currency is known")
    void rateRidesAlongNextTime() {
        when(instruments.findAll()).thenReturn(List.of(new Instrument(7, "SHEL.L", "Shell", 3)));
        when(yahoo.getUncached(contains("symbols=SHEL.L&"))).thenReturn(spark(quote("SHEL.L", "GBp", "4000")));
        when(yahoo.getUncached(contains("symbols=GBPUSD%3DX&"))).thenReturn(spark(quote("GBPUSD=X", "USD", "1.3")));
        when(yahoo.getUncached(contains("symbols=SHEL.L,GBPUSD%3DX&"))).thenReturn(spark(
                quote("SHEL.L", "GBp", "4000"), quote("GBPUSD=X", "USD", "1.3")));

        scheduler.refresh();
        scheduler.refresh();

        verify(instruments, times(2)).updateLastPrice(7, new BigDecimal("52.000000"));
        verify(yahoo, times(1)).getUncached(contains("symbols=GBPUSD%3DX&"));
    }

    @Test
    @DisplayName("keeps previous prices when Yahoo refuses")
    void keepsPricesWhenYahooFails() {
        when(instruments.findAll()).thenReturn(List.of(new Instrument(1, "AAPL", "Apple", 1)));
        when(yahoo.getUncached(anyString())).thenThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "busy"));

        scheduler.refresh();

        verify(instruments, never()).updateLastPrice(anyInt(), any());
        verify(history, never()).upsert(anyInt(), any(), any());
    }

    @Test
    @DisplayName("splits more than 20 symbols across requests")
    void batchesOfTwenty() {
        List<Instrument> many = new java.util.ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            many.add(new Instrument(i, "S" + i, "Stock " + i, 1));
        }
        when(instruments.findAll()).thenReturn(many);
        when(yahoo.getUncached(anyString())).thenReturn(spark());

        scheduler.refresh();

        verify(yahoo, times(2)).getUncached(anyString());
        verify(yahoo).getUncached(contains("symbols=S1,S2,"));
        verify(yahoo).getUncached(contains("symbols=S21,S22,S23,S24,S25&"));
    }

    @Test
    @DisplayName("backfills a year of history for a new instrument")
    void backfillsNewInstrument() {
        when(instruments.findAll()).thenReturn(List.of(new Instrument(20, "NVDA", "NVIDIA", 1)));
        when(history.findEarliestObservedAt(20)).thenReturn(null);
        when(yahoo.getUncached(anyString())).thenReturn(spark(quote("NVDA", "USD", "217.68")));
        when(yahoo.get(contains("interval=1d"))).thenReturn(
                "{\"chart\":{\"result\":[{\"timestamp\":[1700000000,1700086400],\"indicators\":{\"quote\":[{\"close\":[400.5,null]}]}}]}}");
        when(yahoo.get(contains("interval=15m"))).thenReturn("{\"chart\":{\"result\":[]}}");

        scheduler.refresh();

        verify(history).insertIfAbsent(eq(20), eq(Instant.ofEpochSecond(1700000000)), eq(new BigDecimal("400.500000")));
        verify(history, times(1)).insertIfAbsent(anyInt(), any(), any());
    }
}
