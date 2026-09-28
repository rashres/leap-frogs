package com.neueda.leap.services;

import com.neueda.leap.services.domain.*;
import com.neueda.leap.services.domain.Order;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class OrderService {

    public boolean submitOrder(Account account, Instrument instrument, String side, BigDecimal quantity) {
        Order order = new Order(account, instrument, side, quantity);
        processOrder(order);
        return true;
    }

    private void processOrder(Order order) {
        
    }

}
