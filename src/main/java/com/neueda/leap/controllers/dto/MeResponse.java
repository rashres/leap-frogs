package com.neueda.leap.controllers.dto;

import com.neueda.leap.security.AppRole;
import com.neueda.leap.security.LeapUserPrincipal;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "The signed-in user")
public record MeResponse(
        int userId,
        String username,
        String displayName,
        AppRole role,
        Integer accountId,
        String homePath
) {
    public static MeResponse from(LeapUserPrincipal user) {
        return new MeResponse(
                user.getUserId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getRole(),
                user.getAccountId(),
                homePathFor(user.getRole()));
    }

    public static String homePathFor(AppRole role) {
        return switch (role) {
            case SUPER_ADMIN, TRADER -> "/portfolio";
            case BUSINESS_ANALYST -> "/analytics";
            case TRADING_OPERATIONS -> "/ops";
        };
    }
}
