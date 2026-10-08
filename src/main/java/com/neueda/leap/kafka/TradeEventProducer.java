package com.neueda.leap.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class TradeEventProducer {

    // Logger.
    private static final Logger log = LoggerFactory.getLogger(TradeEventProducer.class);
    // Trade-executed topic.
    private static final String TRADE_EXECUTED_TOPIC = "trade.executed";
    // Order-completed topic.
    private static final String ORDER_COMPLETED_TOPIC = "order.completed";

    // Kafka publisher.
    private final KafkaTemplate<String, Object> kafkaTemplate;

    // Create the producer.
    public TradeEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    // Publish a trade event.
    public void publish(TradeExecutedEvent event) {
        send(TRADE_EXECUTED_TOPIC, String.valueOf(event.accountId()), event, event.orderId(), "trade.executed");
    }

    // Publish an order-completed event.
    public void publish(OrderCompletedEvent event) {
        send(ORDER_COMPLETED_TOPIC, String.valueOf(event.getOrder().getOrderId()), event,
                event.getOrder().getOrderId(), "order.completed");
    }

    // Send the event to Kafka.
    private void send(String topic, String key, Object event, int orderId, String eventName) {
        kafkaTemplate.send(topic, key, event)
                .whenComplete((result, exception) -> {
                    if (exception != null) {
                        log.error("Failed to publish {} for order {}: {}",
                                eventName, orderId, exception.getMessage(), exception);
                    } else {
                        log.debug("Published {} for order {} to partition {}",
                                eventName, orderId, result.getRecordMetadata().partition());
                    }
                });
    }
}
