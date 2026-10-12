package com.neueda.leap.kafka;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class TradeEventListener {

    private final TradeEventProducer tradeEventProducer;

    public TradeEventListener(TradeEventProducer tradeEventProducer) {
        this.tradeEventProducer = tradeEventProducer;
    }

    // Runs only after the order's database transaction commits.
    // If the transaction rolls back, this never runs, so Kafka never hears about it.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCompleted(OrderCompletedEvent event) {
        tradeEventProducer.publish(TradeExecutedEvent.from(event.getOrder()));
    }
}
