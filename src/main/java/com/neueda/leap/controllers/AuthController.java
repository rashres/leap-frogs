package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.LoginRequest;
import com.neueda.leap.controllers.dto.MeResponse;
import com.neueda.leap.controllers.dto.RegisterRequest;
import com.neueda.leap.security.AppRole;
import com.neueda.leap.security.LeapUserPrincipal;
import com.neueda.leap.services.AccessDeniedException;
import com.neueda.leap.services.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@Tag(name = "Auth", description = "Sign in, sign up and session")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final RegistrationService registrationService;

    public AuthController(AuthenticationManager authenticationManager, RegistrationService registrationService) {
        this.authenticationManager = authenticationManager;
        this.registrationService = registrationService;
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in (traders, analyst, operations)")
    public MeResponse login(@Valid @RequestBody LoginRequest body,
                            HttpServletRequest request,
                            HttpServletResponse response) {
        LeapUserPrincipal principal = authenticate(body.username(), body.password(), request, response);
        if (principal.getRole() == AppRole.SUPER_ADMIN) {
            // Super Admin must use the dedicated admin entry point.
            clearSession(request);
            throw new AccessDeniedException("Use the Super Admin sign-in page");
        }
        return MeResponse.from(principal);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Sign up as a trader",
            description = "Creates a trading account and a TRADER login for it, then signs in. "
                        + "409 if the username or email is already taken.")
    public MeResponse register(@Valid @RequestBody RegisterRequest body,
                               HttpServletRequest request,
                               HttpServletResponse response) {
        String username = registrationService.register(body.name(), body.email(), body.username(), body.password());
        return MeResponse.from(authenticate(username, body.password(), request, response));
    }

    @PostMapping("/admin/login")
    @Operation(summary = "Super Admin sign-in only")
    public MeResponse adminLogin(@Valid @RequestBody LoginRequest body,
                                 HttpServletRequest request,
                                 HttpServletResponse response) {
        LeapUserPrincipal principal = authenticate(body.username(), body.password(), request, response);
        if (principal.getRole() != AppRole.SUPER_ADMIN) {
            clearSession(request);
            throw new AccessDeniedException("Not a Super Admin account");
        }
        return MeResponse.from(principal);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Sign out")
    public void logout(HttpServletRequest request) {
        clearSession(request);
    }

    @GetMapping("/me")
    @Operation(summary = "Current session user")
    public MeResponse me(Authentication authentication, HttpServletRequest request) {
        if (authentication == null || !(authentication.getPrincipal() instanceof LeapUserPrincipal principal)) {
            throw new AccessDeniedException("Sign in required");
        }
        // Touch CSRF so the cookie is issued for the SPA before mutating calls.
        CsrfToken csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrf != null) {
            csrf.getToken();
        }
        return MeResponse.from(principal);
    }

    private LeapUserPrincipal authenticate(String username, String password,
                                           HttpServletRequest request, HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username.trim(), password));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        HttpSession session = request.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        CsrfToken csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (csrf != null) {
            response.setHeader(csrf.getHeaderName(), csrf.getToken());
        }
        return (LeapUserPrincipal) authentication.getPrincipal();
    }

    private static void clearSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
