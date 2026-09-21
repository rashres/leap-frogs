package com.neueda.leap;

import java.math.BigDecimal;

public class Main {
    public static void main(String[] args) {
        Exchange nasdaq = new Exchange();
        nasdaq.setExchangeId(1);
        nasdaq.setName("NASDAQ");
        nasdaq.setCountry("USA");

        Instrument apple = new Instrument(1, "AAPL", "Apple Inc.", nasdaq.getExchangeId());
        Instrument microsoft = new Instrument(2, "MSFT", "Microsoft Corporation", nasdaq.getExchangeId());

        Account account = new Account(1001, "Jane Doe", "jane@example.com", new BigDecimal("10000.00"));

        Order buyOrder = new Order(account, apple, "BUY", 10);
        Order sellOrder = new Order(account, microsoft, "SELL", 5);

        OrderExecutor executor = new OrderExecutor();
        executor.process_order(buyOrder);
        executor.process_order(sellOrder);

        System.out.println("Orders processed");
    }
}