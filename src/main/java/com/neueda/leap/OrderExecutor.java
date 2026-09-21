package com.neueda.leap;

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

        order.setStatus("COMPLETE");

        return true;
    }

    private void update_holdings(Order order) {

        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();

        if (account.getHolding(instrument) != null) {
            Holding holding = account.getHolding(instrument);
            holding.updateQuantity(order.getSide(), order.getQuantity());
        } else {
            Holding holding = new Holding(account.getAccountId(), instrument, order.getQuantity());
            account.addHolding(instrument, holding);
        }

    }

}
