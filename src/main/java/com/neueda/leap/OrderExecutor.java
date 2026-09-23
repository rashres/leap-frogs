package com.neueda.leap;

import java.math.BigDecimal;
import java.util.Map;

public class OrderExecutor {

    public OrderExecutor() {
    }

    public boolean process_order(Order order) {
        order.setStatus("PENDING");

        if (!OrderValidator.isValidOrder(order)) {
            order.setStatus("FAILED");
            System.out.println("Order could not be Processed");
            return false;
        }

        ExternalService service = new ExternalService();
        service.executeTrade(order);

        update_holdings(order);
        update_balance(order);

        order.setStatus("COMPLETE");
        System.out.println("Order Processed");

        return true;
    }

    private void update_holdings(Order order) {

        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();
        Holding holding;

        if (account.getHolding(instrument) != null) {
            holding = account.getHolding(instrument);
            holding.updateQuantity(order.getSide(), order.getQuantity());
            BigDecimal zero = new BigDecimal(0.00000);
            BigDecimal holdQuantity = holding.getQuantity();
            if (zero.compareTo(holdQuantity) == 0) {
                Map<Instrument, Holding> holdings = account.getHoldings();
                holdings.remove(instrument);
            }
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
