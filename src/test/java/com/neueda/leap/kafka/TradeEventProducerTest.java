package com.neueda.leap.kafka;

import org.apache.kafka.common.KafkaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@DisplayName("TradeEventProducer Tests")
class TradeEventProducerTest {

    private KafkaTemplate<String, TradeExecutedEvent> kafkaTemplate;
    private TradeEventProducer producer;
    private TradeExecutedEvent event;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        kafkaTemplate = mock(KafkaTemplate.class);
        producer = new TradeEventProducer(kafkaTemplate, "test.trade.executed");
        event = new TradeExecutedEvent(101, 42, 3, "AAPL", "BUY", new BigDecimal("5"),
                new BigDecimal("10"), new BigDecimal("50"), Instant.now());
    }

    @Test
    @DisplayName("Should send to the configured topic, keyed by account ID")
    void testSendsToConfiguredTopicWithAccountKey() {
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(new CompletableFuture<>());

        producer.publish(event);

        verify(kafkaTemplate).send("test.trade.executed", "42", event);
    }

    @Test
    @DisplayName("Should not throw when the send fails later (broker error)")
    void testAsyncFailureIsLoggedNotThrown() {
        when(kafkaTemplate.send(anyString(), anyString(), any()))
                .thenReturn(CompletableFuture.failedFuture(new KafkaException("broker down")));

        assertDoesNotThrow(() -> producer.publish(event));
    }

    @Test
    @DisplayName("Should not throw when the broker is unreachable right away")
    void testSyncFailureIsLoggedNotThrown() {
        when(kafkaTemplate.send(anyString(), anyString(), any()))
                .thenThrow(new KafkaException("timed out waiting for metadata"));

        assertDoesNotThrow(() -> producer.publish(event));
    }
}
