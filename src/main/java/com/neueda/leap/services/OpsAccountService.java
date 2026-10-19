package com.neueda.leap.services;

import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.AccountStatusEventMapper;
import com.neueda.leap.mappers.AppUserMapper;
import com.neueda.leap.security.AccessControl;
import com.neueda.leap.security.AppRole;
import com.neueda.leap.security.LeapUserPrincipal;
import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.AppUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class OpsAccountService {

    private final AccountMapper accountMapper;
    private final AccountStatusEventMapper eventMapper;
    private final AppUserMapper appUserMapper;
    private final AccountService accountService;
    private final AccessControl access;

    public OpsAccountService(AccountMapper accountMapper, AccountStatusEventMapper eventMapper,
                             AppUserMapper appUserMapper, AccountService accountService, AccessControl access) {
        this.accountMapper = accountMapper;
        this.eventMapper = eventMapper;
        this.appUserMapper = appUserMapper;
        this.accountService = accountService;
        this.access = access;
    }

    public List<Account> search(String q, String status) {
        access.assertCanListAllAccounts();
        String cleanedStatus = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        if (cleanedStatus != null && !cleanedStatus.equals("ACTIVE") && !cleanedStatus.equals("FROZEN")) {
            throw new InvalidOrderException("status must be ACTIVE or FROZEN");
        }
        return accountMapper.search(q == null ? "" : q.trim(),
                cleanedStatus == null ? "" : cleanedStatus);
    }

    @Transactional
    public Account freeze(int accountId, String reason) {
        access.assertCanFreeze();
        if (reason == null || reason.isBlank()) {
            throw new InvalidOrderException("A reason is required when freezing an account");
        }
        Account account = accountService.findById(accountId);
        assertNotProtected(accountId);
        if (account.isFrozen()) {
            return account;
        }
        LeapUserPrincipal actor = access.requireUser();
        accountMapper.updateStatus(accountId, "FROZEN");
        eventMapper.insert(accountId, actor.getUserId(), "FREEZE", reason.trim());
        return accountService.findById(accountId);
    }

    @Transactional
    public Account unfreeze(int accountId) {
        access.assertCanFreeze();
        Account account = accountService.findById(accountId);
        if (!account.isFrozen()) {
            return account;
        }
        LeapUserPrincipal actor = access.requireUser();
        accountMapper.updateStatus(accountId, "ACTIVE");
        eventMapper.insert(accountId, actor.getUserId(), "UNFREEZE", null);
        return accountService.findById(accountId);
    }

    public List<Map<String, Object>> statusEvents(int accountId) {
        access.assertCanReadAccount(accountId);
        return eventMapper.findRecentForAccount(accountId);
    }

    /** Do not freeze an account linked to the Super Admin identity. */
    private void assertNotProtected(int accountId) {
        AppUser admin = appUserMapper.findByUsername("admin");
        if (admin != null && admin.getRole() == AppRole.SUPER_ADMIN
                && admin.getAccountId() != null && admin.getAccountId() == accountId) {
            throw new AccessDeniedException("Cannot freeze the Super Admin account");
        }
    }
}
