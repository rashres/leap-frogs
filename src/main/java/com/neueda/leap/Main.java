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
        BigDecimal b2 = new BigDecimal("20");
        BigDecimal b3 = new BigDecimal("7");

        Order buyOrder = new Order(account, apple, "BUY", b1);
        Order sellOrder = new Order(account, microsoft, "BUY", b2);
        Order sellOrder2 = new Order(account, microsoft, "SELL", b3);

        OrderExecutor executor = new OrderExecutor();
        System.out.println(executor.process_order(buyOrder));
        System.out.println(executor.process_order(sellOrder));
        System.out.println(executor.process_order(sellOrder2));

        Holding hold1 = account.getHolding(apple);
        Holding hold2 = account.getHolding(microsoft);


        System.out.println("\nOrder 1 Results");
        System.out.println("Holding: " + hold1.getInstrument().getName());
        System.out.println("Quantity: " + hold1.getQuantity());

        System.out.println("\nOrder 2 Results");
        System.out.println("Holding: " + hold2.getInstrument().getName());
        System.out.println("Quantity: " + hold2.getQuantity());
        System.out.println("Orders processed");
    }
}