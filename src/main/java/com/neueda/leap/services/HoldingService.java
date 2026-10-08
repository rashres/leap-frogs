package com.neueda.leap.services;

import com.neueda.leap.mappers.HoldingsMapper;
import com.neueda.leap.services.domain.Holding;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HoldingService {

    private final HoldingsMapper holdingsMapper;
    private final AccountService accountService;

    public HoldingService(HoldingsMapper holdingsMapper, AccountService accountService) {
        this.holdingsMapper = holdingsMapper;
        this.accountService = accountService;
    }

    public List<Holding> findByAccountId(int accountId) {
        // Unknown account -> 404, instead of an empty list that looks like "owns nothing".
        accountService.findById(accountId);
        return holdingsMapper.findByAccountId(accountId);
    }
}
