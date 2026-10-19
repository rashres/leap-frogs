package com.neueda.leap.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Checks copy stop-losses on a timer, since a copy's value moves with prices
 * even when nobody trades. See CopyTradingService.checkStopLosses.
 */
@Component
public class CopyStopLossProcessor {

    private final CopyTradingService copyTradingService;
    private final boolean enabled;

    public CopyStopLossProcessor(CopyTradingService copyTradingService,
                                 @Value("${copy.stoploss.enabled:true}") boolean enabled) {
        this.copyTradingService = copyTradingService;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${copy.stoploss.interval.ms:60000}")
    public void checkStopLosses() {
        if (enabled) {
            copyTradingService.checkStopLosses();
        }
    }
}
