package com.neueda.leap;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Exchange nasdaq = new Exchange();
        nasdaq.setExchangeId(1);
        nasdaq.setName("NASDAQ");
        nasdaq.setCountry("USA");

        Instrument AAPL = new Instrument(1, "AAPL", "AAPL Inc.", nasdaq.getExchangeId());
        Instrument MSFT = new Instrument(2, "MSFT", "MSFT Corporation", nasdaq.getExchangeId());

        Map<String, Instrument> map = new HashMap<String, Instrument>();

        map.put("AAPL", AAPL);
        map.put("MSFT", MSFT);

        Account account = new Account(1001, "Jane Doe", "jane@example.com", new BigDecimal("10000.00"));

        BigDecimal b1 = new BigDecimal("10");
        BigDecimal b2 = new BigDecimal("20");
        BigDecimal b3 = new BigDecimal("7");

        Order buyOrder = new Order(account, AAPL, "BUY", b1);
        Order sellOrder = new Order(account, MSFT, "BUY", b2);
        Order sellOrder2 = new Order(account, MSFT, "SELL", b3);

        OrderExecutor executor = new OrderExecutor();

        /*
        System.out.println(executor.process_order(buyOrder));
        Holding hold1 = account.getHolding(AAPL);
        System.out.println("\nOrder 1 Results");
        System.out.println("Holding: " + hold1.getInstrument().getName());
        System.out.println("Quantity: " + hold1.getQuantity());
        System.out.println("Updated Balance: " + account.getCashBalance());

        System.out.println(executor.process_order(sellOrder));
        System.out.println(executor.process_order(sellOrder2));
        Holding hold2 = account.getHolding(MSFT);
        System.out.println("\nOrder 2 Results");
        System.out.println("Holding: " + hold2.getInstrument().getName());
        System.out.println("Quantity: " + hold2.getQuantity());
        System.out.println("Updated Balance: " + account.getCashBalance());

        System.out.println("Orders processed");
         */

        boolean on = true;
        Scanner scan = new Scanner(System.in);


        while (on) {
            System.out.println("\nEnter Command:");
            String command = scan.nextLine();
            Instrument instrument;
            BigDecimal quantity;
            switch (command) {
                case "ORDER":
                    System.out.println("Enter Instrument");
                    String name = scan.nextLine();
                    instrument = map.get(name);
                    System.out.println("Enter amount:");
                    quantity = BigDecimal.valueOf(scan.nextDouble());
                    scan.nextLine();
                    System.out.println("BUY or SELL?");
                    String side = scan.nextLine();

                    Order order = new Order(account, instrument, side, quantity);
                    boolean success = executor.process_order(order);
                    if (success) {
                        Holding holding = account.getHolding(instrument);
                        System.out.println("\nOrder Results:");
                        switch (side) {
                            case "BUY":
                                System.out.println("" + quantity + " shares of " + name + " purchased");
                                break;
                            case "SELL":
                                System.out.println("" + quantity + " shares of " + name + " sold");
                                break;
                        }
                        if (account.getHolding(instrument) != null) {
                            BigDecimal value = holding.getQuantity().multiply(order.getPrice());
                            System.out.println(name + " Holding: " + holding.getQuantity() + " shares, Value: $" + value);
                            System.out.println("Updated Balance: " + account.getCashBalance());
                        } else {
                            System.out.println("No Holding for " + instrument.getName());
                        }
                    }
                    break;
                case "HOLDINGS":
                    Map<Instrument, Holding> holdings = account.getHoldings();
                    System.out.println("\nAll Holdings:");
                    for (Map.Entry<Instrument, Holding> entry : holdings.entrySet()) {
                        instrument = entry.getKey();
                        Holding holding = entry.getValue();
                        System.out.println("\n" + instrument.getName());
                        System.out.println("Shares: " + holding.getQuantity());
                        quantity = holding.getQuantity();
                        BigDecimal value = quantity.multiply(instrument.getPrice());
                        System.out.println("Total Value: $" + value);
                    }
                    break;
                case "END":
                    on = false;
                    break;
                default:
                    System.out.println("Invalid Command");
            }
        }

        System.out.println("Session Ended");
    }
}