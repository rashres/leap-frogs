package com.neueda.leap.services;

import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.mappers.InstrumentMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;

@Service
public class OrderService {

    AccountService accountService;
    InstrumentMapper instrumentMapper;
    HoldingsMapper holdingsMapper;
    OrderMapper orderMapper;

    public OrderService(AccountService accountService, InstrumentMapper instrumentMapper, HoldingsMapper holdingsMapper, OrderMapper orderMapper) {
        this.accountService = accountService;
        this.instrumentMapper = instrumentMapper;
        this.holdingsMapper = holdingsMapper;
        this.orderMapper = orderMapper;
    }

    public Order create_order(int accountID, int instrumentID, String side, String quantity) {
        Account account = accountService.findById(accountID);
        Instrument instrument = instrumentMapper.findByInstrumentId(instrumentID);
        return new Order(account, instrument, side, new BigDecimal(quantity));
    }

    public boolean process_order(Order order, int accountId) {
        order.setStatus("PENDING");

        Account account = accountService.findById(accountId);

        if (!OrderValidator.isValidOrder(order)) {
            order.setStatus("FAILED");
            System.out.println("Order could not be Processed");
            return false;
        }

        ExternalService service = new ExternalService();
        service.executeTrade(order);

        update_holdings(order, account);
        update_balance(order, account);

        order.setStatus("COMPLETE");
        System.out.println("Order Processed");

        orderMapper.insertOrder(order);

        return true;
    }

    private void update_holdings(Order order, Account account) {

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

        holdingsMapper.upsertHolding(holding);

    }

    private void update_balance(Order order, Account account) {

        BigDecimal value = order.getValue();
        String side = order.getSide();

        accountService.updateBalance(value, account, side);
    }

}
