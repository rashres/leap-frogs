package com.neueda.leap.services;


import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.CashTransferMapper;
import com.neueda.leap.mappers.OrderMapper;
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;


@Service
public class AccountService {

    private final AccountMapper accountMapper;
    private final CashTransferMapper cashTransferMapper;
    private final OrderMapper orderMapper;

    public AccountService(AccountMapper accountMapper, CashTransferMapper cashTransferMapper, OrderMapper orderMapper) {
        this.accountMapper = accountMapper;
        this.cashTransferMapper = cashTransferMapper;
        this.orderMapper = orderMapper;
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
            throw new InvalidCashException("Account is frozen; deposits are not allowed");
        }
        requirePositive(amount);
        accountMapper.addCash(accountId, amount);
        cashTransferMapper.insertDeposit(accountId, amount);
        return findById(accountId);
    }

    /**
     * Takes cash out of an account and records the withdrawal. Cash held back
     * for pending buy orders cannot be withdrawn, and a frozen account cannot
     * withdraw at all.
     */
    @Transactional
    public Account withdraw(int accountId, BigDecimal amount) {
        Account account = findById(accountId);
        if (account.isFrozen()) {
            throw new InvalidCashException("Account is frozen; withdrawals are not allowed");
        }
        requirePositive(amount);
        BigDecimal reserved = orderMapper.reservedCash(accountId);
        if (accountMapper.withdrawCash(accountId, amount, reserved) == 0) {
            BigDecimal available = account.getCashBalance().subtract(reserved).max(BigDecimal.ZERO);
            throw new InvalidCashException("Insufficient cash to withdraw: available " + available.setScale(2, RoundingMode.HALF_UP));
        }
        cashTransferMapper.insertWithdrawal(accountId, amount);
        return findById(accountId);
    }

    private static void requirePositive(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new InvalidCashException("amount must be greater than 0");
        }
    }

    public void updateBalance(BigDecimal value, Account account, String side) {
        account.updateCashBalance(value, side);
        accountMapper.updateBalance(account.getAccountId(), account.getCashBalance());
    }

}
