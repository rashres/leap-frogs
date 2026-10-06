package com.neueda.leap;

import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.services.AccountService;
import com.neueda.leap.services.domain.Account;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Integration tests for AccountService with real database.
 *
 * Uses @SpringBootTest to load the full Spring context and connect to the database.
 * Uses @Transactional to automatically rollback changes after each test.
 */
@SpringBootTest
@DisplayName("AccountService Database Integration Tests")
class AccountServiceIntegrationTest {

    @Autowired
    private AccountService accountService;

    @Autowired
    private AccountMapper accountMapper;

    @Test
    @Transactional
    @DisplayName("updateBalance subtracts cash for a BUY order and persists to database")
    void updateBalanceSubtractsCashForBuy() {
        // Arrange
        int accountId = 1;
        Account account = accountService.findById(accountId);
        BigDecimal originalBalance = account.getCashBalance();
        BigDecimal orderValue = new BigDecimal("500.00");

        // Act
        accountService.updateBalance(orderValue, account, "BUY");

        // Assert - check the object in memory
        assertEquals(originalBalance.subtract(orderValue), account.getCashBalance());

        // Assert - verify the change persisted to the database
        Account updatedAccountFromDb = accountMapper.findById(accountId);
        assertEquals(originalBalance.subtract(orderValue), updatedAccountFromDb.getCashBalance(),
                "Account balance should be reduced by order value in database");
    }

    @Test
    @Transactional
    @DisplayName("updateBalance adds cash for a SELL order and persists to database")
    void updateBalanceAddsCashForSell() {
        // Arrange
        int accountId = 1;
        Account account = accountService.findById(accountId);
        BigDecimal originalBalance = account.getCashBalance();
        BigDecimal saleProceeds = new BigDecimal("1000.00");

        // Act
        accountService.updateBalance(saleProceeds, account, "SELL");

        // Assert - check the object in memory
        assertEquals(originalBalance.add(saleProceeds), account.getCashBalance());

        // Assert - verify the change persisted to the database
        Account updatedAccountFromDb = accountMapper.findById(accountId);
        assertEquals(originalBalance.add(saleProceeds), updatedAccountFromDb.getCashBalance(),
                "Account balance should be increased by sale proceeds in database");
    }

    @Test
    @Transactional
    @DisplayName("multiple balance updates are all persisted correctly")
    void multipleUpdatesArePersisted() {
        // Arrange
        int accountId = 1;
        Account account = accountService.findById(accountId);
        BigDecimal originalBalance = account.getCashBalance();

        // Act
        accountService.updateBalance(new BigDecimal("100.00"), account, "BUY");
        accountService.updateBalance(new BigDecimal("50.00"), account, "SELL");
        accountService.updateBalance(new BigDecimal("200.00"), account, "BUY");

        // Assert - verify the final balance
        BigDecimal expectedBalance = originalBalance
                .subtract(new BigDecimal("100.00"))
                .add(new BigDecimal("50.00"))
                .subtract(new BigDecimal("200.00"));

        Account updatedAccountFromDb = accountMapper.findById(accountId);
        assertEquals(expectedBalance, updatedAccountFromDb.getCashBalance(),
                "All balance updates should persist to database");
    }
}
