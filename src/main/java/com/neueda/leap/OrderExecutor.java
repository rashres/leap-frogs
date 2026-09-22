package com.neueda.leap;

import java.math.BigDecimal;

public class OrderExecutor {

    public OrderExecutor() {
    }

    public boolean process_order(Order order) {
        order.setStatus("PENDING");

        if (!OrderValidator.isValidOrder(order)) {
            order.setStatus("FAILED");
            return false;
        }

        ExternalService service = new ExternalService();
        service.executeTrade(order);

        update_holdings(order);
        update_balance(order);

        order.setStatus("COMPLETE");

        return true;
    }

    private void update_holdings(Order order) {

        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();
        Holding holding;

        if (account.getHolding(instrument) != null) {
            holding = account.getHolding(instrument);
            holding.updateQuantity(order.getSide(), order.getQuantity());
        } else {
            holding = new Holding(account.getAccountId(), instrument, order.getQuantity());
            account.addHolding(instrument, holding);
        }

    }

    private void update_balance(Order order) {

        Account account = order.getAccount();
        BigDecimal value = order.getValue();
        String side = order.getSide();

        account.updateCashBalance(value, side);
    }

}
