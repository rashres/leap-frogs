package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.AccountResponse;
import com.neueda.leap.services.AccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Controller for Accounts (read-only for now)
 */
@RestController
@RequestMapping("/accounts")
@CrossOrigin(origins = "*")
@Tag(name = "Accounts", description = "Account endpoints")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    /**
     * GET /api/accounts
     */
    @GetMapping
    @Operation(summary = "List accounts", description = "Returns all accounts from the database")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Accounts retrieved")
    })
    public List<AccountResponse> getAllAccounts() {
        return accountService.findAll().stream()
                .map(AccountResponse::from)
                .toList();
    }

    /**
     * GET /api/accounts/{id}
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get account", description = "Returns one account by its id")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Account found"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public AccountResponse getAccount(@PathVariable int id) {
        return AccountResponse.from(accountService.findById(id));
    }
}
