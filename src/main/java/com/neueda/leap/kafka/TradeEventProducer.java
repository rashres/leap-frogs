package com.neueda.leap.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class TradeEventProducer {

    // Logger.
    private static final Logger log = LoggerFactory.getLogger(TradeEventProducer.class);

    // Kafka publisher.
    private final KafkaTemplate<String, TradeExecutedEvent> kafkaTemplate;
    // Trade-executed topic (from KAFKA_TOPIC_TRADE_EXECUTED, default trade.executed).
    private final String topic;

    // Create the producer.
    public TradeEventProducer(KafkaTemplate<String, TradeExecutedEvent> kafkaTemplate,
                              @Value("${app.kafka.trade-executed-topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    // Publish a trade event, keyed by account so one account's trades stay in order.
    // Failures are logged, not thrown: the order is already saved, and an error here
    // could make the client retry and place the same order twice.
    public void publish(TradeExecutedEvent event) {
        String key = String.valueOf(event.accountId());
        try {
            kafkaTemplate.send(topic, key, event)
                    .whenComplete((result, exception) -> {
                        if (exception != null) {
                            log.error("Failed to publish trade.executed for order {}: {}",
                                    event.orderId(), exception.getMessage(), exception);
                        } else {
                            log.debug("Published trade.executed for order {} to partition {}",
                                    event.orderId(), result.getRecordMetadata().partition());
                        }
                    });
        } catch (Exception exception) {
            log.error("Failed to publish trade.executed for order {}: {}",
                    event.orderId(), exception.getMessage(), exception);
        }
    }
}
