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

        //TODO: ExternalService Logic

        Account account = order.getAccount();

        return true;
    }

}
