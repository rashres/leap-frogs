package com.neueda.leap.security;

import com.neueda.leap.services.domain.AppUser;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/** Authenticated identity held in the HTTP session. */
public class LeapUserPrincipal implements UserDetails {

    private final int userId;
    private final String username;
    private final String passwordHash;
    private final String displayName;
    private final AppRole role;
    private final Integer accountId;

    public LeapUserPrincipal(AppUser user) {
        this.userId = user.getUserId();
        this.username = user.getUsername();
        this.passwordHash = user.getPasswordHash();
        this.displayName = user.getDisplayName();
        this.role = user.getRole();
        this.accountId = user.getAccountId();
    }

    public int getUserId() {
        return userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public AppRole getRole() {
        return role;
    }

    public Integer getAccountId() {
        return accountId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role.authority()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
