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

        BigDecimal b1 = new BigDecimal("10");
        BigDecimal b2 = new BigDecimal("5");

        Order buyOrder = new Order(account, apple, "BUY", b1);
        Order sellOrder = new Order(account, microsoft, "SELL", b2);

        OrderExecutor executor = new OrderExecutor();
        System.out.println(executor.process_order(buyOrder));
        System.out.println(executor.process_order(sellOrder));

        Holding final_hold = account.getHolding(apple);
        System.out.println("1st order: " + final_hold.getInstrument().getName());

        System.out.println("Orders processed");
    }
}