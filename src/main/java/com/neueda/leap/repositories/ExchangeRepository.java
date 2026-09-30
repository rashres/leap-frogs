package com.neueda.leap.repositories;

import com.neueda.leap.services.domain.Exchange;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory exchange store, seeded to match database/capstone-mvp-schema.sql.
 */
@Repository
public class ExchangeRepository {

    private final Map<Integer, Exchange> exchanges = new ConcurrentHashMap<>();

    public ExchangeRepository() {
        add(1, "NASDAQ", "USA");
        add(2, "Binance", "Global");
    }

    public List<Exchange> findAll() {
        return exchanges.values().stream()
                .sorted(Comparator.comparingInt(Exchange::getExchangeId))
                .toList();
    }

    public Optional<Exchange> findById(int exchangeId) {
        return Optional.ofNullable(exchanges.get(exchangeId));
    }

    private void add(int id, String name, String country) {
        Exchange exchange = new Exchange();
        exchange.setExchangeId(id);
        exchange.setName(name);
        exchange.setCountry(country);
        exchanges.put(id, exchange);
    }
}
