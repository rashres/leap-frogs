package com.neueda.leap.security;

import com.neueda.leap.services.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Central permission checks. Controllers call these; never trust a client-supplied role.
 */
@Component("access")
public class AccessControl {

    public LeapUserPrincipal requireUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof LeapUserPrincipal principal)) {
            throw new AccessDeniedException("Sign in required");
        }
        return principal;
    }

    public boolean canReadAccount(int accountId) {
        LeapUserPrincipal user = requireUser();
        return switch (user.getRole()) {
            case SUPER_ADMIN, TRADING_OPERATIONS -> true;
            case TRADER -> user.getAccountId() != null && user.getAccountId() == accountId;
            case BUSINESS_ANALYST -> false;
        };
    }

    public void assertCanReadAccount(int accountId) {
        if (!canReadAccount(accountId)) {
            throw new AccessDeniedException("Not allowed to access this account");
        }
    }

    /** Place or cancel orders for the account. */
    public boolean canTrade(int accountId) {
        LeapUserPrincipal user = requireUser();
        return switch (user.getRole()) {
            case SUPER_ADMIN -> true;
            case TRADER -> user.getAccountId() != null && user.getAccountId() == accountId;
            case BUSINESS_ANALYST, TRADING_OPERATIONS -> false;
        };
    }

    public void assertCanTrade(int accountId) {
        if (!canTrade(accountId)) {
            throw new AccessDeniedException("Not allowed to trade on this account");
        }
    }

    public boolean canListAllAccounts() {
        LeapUserPrincipal user = requireUser();
        return user.getRole() == AppRole.SUPER_ADMIN || user.getRole() == AppRole.TRADING_OPERATIONS;
    }

    public void assertCanListAllAccounts() {
        if (!canListAllAccounts()) {
            throw new AccessDeniedException("Not allowed to list all accounts");
        }
    }

    public boolean canAccessAnalytics() {
        LeapUserPrincipal user = requireUser();
        return user.getRole() == AppRole.SUPER_ADMIN || user.getRole() == AppRole.BUSINESS_ANALYST;
    }

    public void assertCanAccessAnalytics() {
        if (!canAccessAnalytics()) {
            throw new AccessDeniedException("Not allowed to access analytics");
        }
    }

    public boolean canAccessAudit() {
        LeapUserPrincipal user = requireUser();
        return user.getRole() == AppRole.SUPER_ADMIN || user.getRole() == AppRole.TRADING_OPERATIONS;
    }

    public void assertCanAccessAudit() {
        if (!canAccessAudit()) {
            throw new AccessDeniedException("Not allowed to access audit logs");
        }
    }

    public boolean canFreeze() {
        LeapUserPrincipal user = requireUser();
        return user.getRole() == AppRole.SUPER_ADMIN || user.getRole() == AppRole.TRADING_OPERATIONS;
    }

    public void assertCanFreeze() {
        if (!canFreeze()) {
            throw new AccessDeniedException("Not allowed to freeze or unfreeze accounts");
        }
    }
}
