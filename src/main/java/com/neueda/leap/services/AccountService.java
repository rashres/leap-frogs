package com.neueda.leap.services;


import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.CashDepositMapper;
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;


@Service
public class AccountService {

    private final AccountMapper accountMapper;
    private final CashDepositMapper cashDepositMapper;

    public AccountService(AccountMapper accountMapper, CashDepositMapper cashDepositMapper) {
        this.accountMapper = accountMapper;
        this.cashDepositMapper = cashDepositMapper;
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

    /**
     * Adds cash to an account and records the deposit, so value history can
     * undo it when rewinding. A frozen account takes no deposits.
     */
    @Transactional
    public Account deposit(int accountId, BigDecimal amount) {
        Account account = findById(accountId);
        if (account.isFrozen()) {
            throw new InvalidDepositException("Account is frozen; deposits are not allowed");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new InvalidDepositException("amount must be greater than 0");
        }
        accountMapper.addCash(accountId, amount);
        cashDepositMapper.insert(accountId, amount);
        return findById(accountId);
    }

    public void updateBalance(BigDecimal value, Account account, String side) {
        account.updateCashBalance(value, side);
        accountMapper.updateBalance(account.getAccountId(), account.getCashBalance());
    }

}
