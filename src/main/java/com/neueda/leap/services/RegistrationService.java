package com.neueda.leap.services;

import com.neueda.leap.mappers.AccountMapper;
import com.neueda.leap.mappers.AppUserMapper;
import com.neueda.leap.security.AppRole;
import com.neueda.leap.services.domain.Account;
import com.neueda.leap.services.domain.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Self-service sign-up: a new trading account plus a TRADER login for it.
 * Only traders can sign up; staff roles are created by hand.
 */
@Service
public class RegistrationService {

    private final AccountMapper accountMapper;
    private final AppUserMapper appUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final BigDecimal startingCash;

    public RegistrationService(AccountMapper accountMapper, AppUserMapper appUserMapper, PasswordEncoder passwordEncoder,
                               @Value("${signup.starting-cash:0}") BigDecimal startingCash) {
        this.accountMapper = accountMapper;
        this.appUserMapper = appUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.startingCash = startingCash;
    }

    /**
     * Creates the account and login together, or neither.
     *
     * @return the username as stored (lower case), for signing in
     * @throws RegistrationConflictException if the username or email is taken
     */
    @Transactional
    public String register(String name, String email, String username, String password) {
        String cleanUsername = username.trim().toLowerCase(Locale.ROOT);
        String cleanEmail = email.trim().toLowerCase(Locale.ROOT);
        if (appUserMapper.findByUsername(cleanUsername) != null) {
            throw new RegistrationConflictException("That username is taken");
        }
        if (accountMapper.existsByEmail(cleanEmail)) {
            throw new RegistrationConflictException("An account with that email already exists");
        }

        Account account = new Account(0, name.trim(), cleanEmail, startingCash);
        accountMapper.insert(account);

        AppUser user = new AppUser();
        user.setUsername(cleanUsername);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(name.trim());
        user.setRole(AppRole.TRADER);
        user.setAccountId(account.getAccountId());
        appUserMapper.insert(user);
        return cleanUsername;
    }
}
