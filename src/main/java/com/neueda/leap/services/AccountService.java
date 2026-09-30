package com.neueda.leap.services;

<<<<<<< Updated upstream
import com.neueda.leap.repositories.AccountMapper;
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;

import java.util.List;
=======
import com.neueda.leap.services.domain.Account;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
>>>>>>> Stashed changes

@Service
public class AccountService {

<<<<<<< Updated upstream
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
=======
    Account account;
    Account dummy;

    public AccountService() {
        BigDecimal thousand = new BigDecimal(1000);
        dummy = new Account(000000, "Dummy", "Dummy@dummy.com", thousand);
    }

    public Account getAccount(int accountId) {
        return dummy;
    }


>>>>>>> Stashed changes
}
