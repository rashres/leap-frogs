package com.neueda.leap.services;


import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.CashTransferMapper;
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;


@Service
public class AccountService {

    private final AccountMapper accountMapper;
    /** Most a single deposit can add. Withdrawals have no cap beyond the balance. */
    private static final BigDecimal MAX_DEPOSIT = new BigDecimal("1000000");

    private final CashTransferMapper cashTransferMapper;

    public AccountService(AccountMapper accountMapper, CashTransferMapper cashTransferMapper) {
        this.accountMapper = accountMapper;
        this.cashTransferMapper = cashTransferMapper;
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
        if (amount.compareTo(MAX_DEPOSIT) > 0) {
            throw new InvalidCashException("amount must be at most 1,000,000");
        }
        accountMapper.addCash(accountId, amount);
        cashTransferMapper.insertDeposit(accountId, amount);
        return findById(accountId);
    }

    /**
     * Takes cash out of an account and records the withdrawal. Anything up to
     * the whole balance can go; a pending buy left without the cash is rejected
     * when it tries to fill. A frozen account cannot withdraw.
     */
    @Transactional
    public Account withdraw(int accountId, BigDecimal amount) {
        Account account = findById(accountId);
        if (account.isFrozen()) {
            throw new InvalidCashException("Account is frozen; withdrawals are not allowed");
        }
        requirePositive(amount);
        if (accountMapper.withdrawCash(accountId, amount) == 0) {
            BigDecimal balance = accountMapper.findById(accountId).getCashBalance();
            throw new InvalidCashException("Insufficient cash to withdraw: available " + balance.setScale(2, RoundingMode.HALF_UP));
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
