package com.neueda.leap;

import java.math.BigDecimal;

public class OrderExecutor {

    public OrderExecutor() {
    }

    public boolean process_order(Order order) {
        order.setStatus("PENDING");

        // Validate order format
        if (!OrderValidator.isValidOrder(order)) {
            order.setStatus("FAILED");
            return false;
        }

        // Verify account has sufficient funds/shares before executing
        if (!hasSufficientFunds(order)) {
            order.setStatus("FAILED_INSUFFICIENT_FUNDS");
            return false;
        }

        ExternalService service = new ExternalService();
        service.executeTrade(order);

        update_holdings(order);

        order.setStatus("COMPLETE");

        return true;
    }

    // Verify account has enough cash for BUY or enough shares for SELL
    private boolean hasSufficientFunds(Order order) {
        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();
        BigDecimal quantity = order.getQuantity();
        BigDecimal price = order.getPrice();

        if ("BUY".equalsIgnoreCase(order.getSide())) {
            return canAffordBuy(account, quantity, price);
        } else if ("SELL".equalsIgnoreCase(order.getSide())) {
            return hasEnoughSharesForSell(account, instrument, quantity);
        }

        return false; // Invalid transaction type
    }

    // Check if account has enough cash to buy
    private boolean canAffordBuy(Account account, BigDecimal quantity, BigDecimal price) {
        BigDecimal requiredCash = quantity.multiply(price);
        BigDecimal availableCash = account.getCashBalance();

        return availableCash.compareTo(requiredCash) >= 0;
    }

    // Check if account has enough shares to sell
    private boolean hasEnoughSharesForSell(Account account, Instrument instrument, BigDecimal quantity) {
        Holding holding = account.getHolding(instrument);

        // No holding = can't sell
        if (holding == null) {
            return false;
        }

        // Check if quantity is available
        return holding.getQuantity().compareTo(quantity) >= 0;
    }

    // Update account holdings after successful order execution
    private void update_holdings(Order order) {
        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();
        BigDecimal quantity = order.getQuantity();
        BigDecimal price = order.getPrice();

        if ("BUY".equalsIgnoreCase(order.getSide())) {
            // BUY: Deduct cash, increase shares
            BigDecimal cost = quantity.multiply(price);
            account.setCashBalance(account.getCashBalance().subtract(cost));

            if (account.getHolding(instrument) != null) {
                Holding holding = account.getHolding(instrument);
                holding.buy(quantity, price);
            } else {
                Holding holding = new Holding(account.getAccountId(), instrument, quantity);
                holding.buy(quantity, price);
                account.addHolding(instrument, holding);
            }
        } else if ("SELL".equalsIgnoreCase(order.getSide())) {
            // SELL: Add cash, decrease shares
            BigDecimal proceeds = quantity.multiply(price);
            account.setCashBalance(account.getCashBalance().add(proceeds));

            Holding holding = account.getHolding(instrument);
            if (holding != null) {
                holding.sell(quantity, price);
            }
        }
    }
}
