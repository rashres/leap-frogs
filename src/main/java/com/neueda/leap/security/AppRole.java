package com.neueda.leap.security;

/** Platform roles stored on app_user.role. */
public enum AppRole {
    SUPER_ADMIN,
    TRADER,
    BUSINESS_ANALYST,
    TRADING_OPERATIONS;

    public String authority() {
        return "ROLE_" + name();
    }

    public static AppRole from(String value) {
        return AppRole.valueOf(value.trim().toUpperCase());
    }
}
