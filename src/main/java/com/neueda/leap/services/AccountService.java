package com.neueda.leap.services;


import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;


@Service
public class AccountService {

    private final AccountMapper accountMapper;

    public AccountService(AccountMapper accountMapper) {
        this.accountMapper = accountMapper;
    }

    public List<Account> findAll() {
        return accountMapper.findAll();
    }

    public Account findById(int accountId) {
        Account account = accountMapper.findById(accountId);
        if (account == null) {
            throw new ResourceNotFoundException("Account", accountId);
        }
        return account;
    }

    public void updateBalance(BigDecimal value, Account account, String side) {
        account.updateCashBalance(value, side);
        accountMapper.updateBalance(account.getAccountId(), account.getCashBalance());
    }

}
