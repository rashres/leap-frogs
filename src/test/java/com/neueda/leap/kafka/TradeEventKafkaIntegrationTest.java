package com.neueda.leap.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end check against a real (in-memory) Kafka broker, so no Docker is needed.
 * Uses the real producer settings from application.properties (JSON values, no type headers).
 */
@SpringBootTest(
        classes = TradeEventKafkaIntegrationTest.Config.class,
        properties = "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}")
@EmbeddedKafka(partitions = 3, topics = "trade.executed")
@DisplayName("TradeEvent Kafka Integration Tests")
class TradeEventKafkaIntegrationTest {

    @Configuration
    @EnableTransactionManagement
    @Import({KafkaAutoConfiguration.class, TradeEventProducer.class, TradeEventListener.class})
    static class Config {

        @Bean
        PlatformTransactionManager transactionManager() {
            return new TradeEventListenerTransactionTest.NoOpTransactionManager();
        }
    }

    @Autowired
    private EmbeddedKafkaBroker broker;

    @Autowired
    private TradeEventProducer producer;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private Consumer<String, String> consumer;

    @BeforeEach
    void setUp() {
        Map<String, Object> props = KafkaTestUtils.consumerProps("test-" + System.nanoTime(), "true", broker);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        consumer = new DefaultKafkaConsumerFactory<>(props, new StringDeserializer(), new StringDeserializer())
                .createConsumer();
        broker.consumeFromAnEmbeddedTopic(consumer, "trade.executed");
    }

    @AfterEach
    void tearDown() {
        consumer.close();
    }

    private Order completedOrder(int orderId, int accountId) {
        Instrument instrument = new Instrument(3, "AAPL", "Apple Inc.", 1);
        instrument.setLastPrice(new BigDecimal("10.50"));
        Order order = new Order(new Account(accountId, "Test", "t@example.com", new BigDecimal("1000")),
                instrument, "BUY", new BigDecimal("4"));
        order.setOrderId(orderId);
        order.setStatus("COMPLETE");
        return order;
    }

    private ConsumerRecord<String, String> receiveOrder(int orderId) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        Instant deadline = Instant.now().plusSeconds(10);
        while (Instant.now().isBefore(deadline)) {
            for (ConsumerRecord<String, String> record : KafkaTestUtils.getRecords(consumer, Duration.ofSeconds(2))) {
                if (mapper.readTree(record.value()).get("orderId").asInt() == orderId) {
                    return record;
                }
            }
        }
        return fail("No trade.executed message received for order " + orderId);
    }

    @Test
    @DisplayName("Should write a plain-JSON trade.executed message keyed by account")
    void testProducerWritesJsonToTopic() throws Exception {
        producer.publish(TradeExecutedEvent.from(completedOrder(101, 42)));

        ConsumerRecord<String, String> record = receiveOrder(101);
        assertEquals("42", record.key());
        // No Java type header, so non-Java consumers can read it
        assertNull(record.headers().lastHeader("__TypeId__"));

        JsonNode json = new ObjectMapper().readTree(record.value());
        assertEquals(42, json.get("accountId").asInt());
        assertEquals(3, json.get("instrumentId").asInt());
        assertEquals("AAPL", json.get("symbol").asText());
        assertEquals("BUY", json.get("side").asText());
        assertEquals(0, new BigDecimal("4").compareTo(json.get("quantity").decimalValue()));
        assertEquals(0, new BigDecimal("10.50").compareTo(json.get("price").decimalValue()));
        assertEquals(0, new BigDecimal("42.00").compareTo(json.get("value").decimalValue()));
        // Timestamp is an ISO-8601 string, e.g. 2026-10-12T14:00:00.123Z
        assertDoesNotThrow(() -> Instant.parse(json.get("executedAt").asText()));
    }

    @Test
    @DisplayName("Should reach Kafka when an order-completed event is published inside a committed transaction")
    void testCommittedOrderReachesKafka() throws Exception {
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                eventPublisher.publishEvent(new OrderCompletedEvent(completedOrder(202, 7))));

        ConsumerRecord<String, String> record = receiveOrder(202);
        assertEquals("7", record.key());
    }
}
