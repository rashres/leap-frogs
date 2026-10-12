package com.neueda.leap.kafka;

import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.Instrument;
import com.neueda.leap.services.domain.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Checks the "only after commit" rule with a real Spring transaction.
 * A do-nothing transaction manager stands in for the database, so no Postgres or Kafka is needed.
 */
@SpringJUnitConfig(TradeEventListenerTransactionTest.Config.class)
@DisplayName("TradeEventListener Transaction Tests")
class TradeEventListenerTransactionTest {

    @Configuration
    @EnableTransactionManagement
    static class Config {

        @Bean
        TradeEventProducer tradeEventProducer() {
            return mock(TradeEventProducer.class);
        }

        @Bean
        TradeEventListener tradeEventListener(TradeEventProducer tradeEventProducer) {
            return new TradeEventListener(tradeEventProducer);
        }

        @Bean
        PlatformTransactionManager transactionManager() {
            return new NoOpTransactionManager();
        }
    }

    // Runs the full begin/commit/rollback lifecycle without a database
    static class NoOpTransactionManager extends AbstractPlatformTransactionManager {
        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
        }
    }

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private TradeEventProducer tradeEventProducer;

    private OrderCompletedEvent event;

    @BeforeEach
    void setUp() {
        reset(tradeEventProducer);
        Instrument instrument = new Instrument(3, "AAPL", "Apple Inc.", 1);
        instrument.setLastPrice(new BigDecimal("10"));
        Order order = new Order(new Account(42, "Test", "t@example.com", new BigDecimal("1000")),
                instrument, "BUY", new BigDecimal("5"));
        order.setOrderId(101);
        order.setStatus("COMPLETE");
        event = new OrderCompletedEvent(order);
    }

    @Test
    @DisplayName("Should publish only after the transaction commits")
    void testPublishesAfterCommit() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            eventPublisher.publishEvent(event);
            // Still inside the transaction: nothing sent yet
            verifyNoInteractions(tradeEventProducer);
        });

        verify(tradeEventProducer).publish(any(TradeExecutedEvent.class));
    }

    @Test
    @DisplayName("Should not publish when the transaction rolls back")
    void testNoPublishOnRollback() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            eventPublisher.publishEvent(event);
            status.setRollbackOnly();
        });

        verifyNoInteractions(tradeEventProducer);
    }

    @Test
    @DisplayName("Should not publish when the transaction fails with an error")
    void testNoPublishOnException() {
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                eventPublisher.publishEvent(event);
                throw new IllegalStateException("simulated database failure");
            });
        } catch (IllegalStateException expected) {
            // rolled back
        }

        verifyNoInteractions(tradeEventProducer);
    }
}
