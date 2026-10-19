package com.neueda.leap.services.domain;

import com.neueda.leap.security.AppRole;

/** A login identity in app_user. Traders link to exactly one account_id. */
public class AppUser {
    private int userId;
    private String username;
    private String passwordHash;
    private String displayName;
    private AppRole role;
    private Integer accountId;

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public AppRole getRole() {
        return role;
    }

    public void setRole(AppRole role) {
        this.role = role;
    }

    /** MyBatis maps the role column as a string. */
    public void setRole(String role) {
        this.role = role == null ? null : AppRole.from(role);
    }

    public Integer getAccountId() {
        return accountId;
    }

    public void setAccountId(Integer accountId) {
        this.accountId = accountId;
    }
}
