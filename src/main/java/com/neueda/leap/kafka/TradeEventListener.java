package com.neueda.leap.kafka;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class TradeEventListener {

    private final TradeEventProducer tradeEventProducer;

    public TradeEventListener(TradeEventProducer tradeEventProducer) {
        this.tradeEventProducer = tradeEventProducer;
    }

    @EventListener
    public void onOrderCompleted(OrderCompletedEvent event) {
        tradeEventProducer.publish(TradeExecutedEvent.from(event.getOrder()));
    }
}
