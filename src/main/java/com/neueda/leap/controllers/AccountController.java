package com.neueda.leap.controllers;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.neueda.leap.controllers.dto.AccountResponse;
import com.neueda.leap.controllers.dto.CashAmountRequest;
import com.neueda.leap.controllers.dto.PortfolioValuePointResponse;
import com.neueda.leap.security.AccessControl;
import com.neueda.leap.services.AccountService;
import com.neueda.leap.services.PortfolioHistoryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * REST API Controller for Accounts: read accounts and value history, and add or withdraw cash.
 */
@RestController
@RequestMapping("/accounts")
@CrossOrigin(origins = "*")
@Tag(name = "Accounts", description = "Account endpoints")
public class AccountController {

    private final AccountService accountService;
    private final PortfolioHistoryService portfolioHistoryService;
    private final AccessControl access;

    public AccountController(AccountService accountService, PortfolioHistoryService portfolioHistoryService,
                             AccessControl access) {
        this.accountService = accountService;
        this.portfolioHistoryService = portfolioHistoryService;
        this.access = access;
    }

    /**
     * GET /api/accounts
     */
    @GetMapping
    @Operation(summary = "List accounts", description = "Returns all accounts from the database")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Accounts retrieved",
            content = @Content(
                mediaType = "application/json",
                array = @ArraySchema(schema = @Schema(implementation = AccountResponse.class))
            )
        )
    })
    public List<AccountResponse> getAllAccounts() {
        access.assertCanListAllAccounts();
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
        @ApiResponse(
            responseCode = "200",
            description = "Account found",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AccountResponse.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Account not found",
            content = @Content(mediaType = "application/json", examples = @ExampleObject(value = """
                    {"timestamp":"2026-10-01T12:00:00.000+00:00","status":404,"error":"Not Found","path":"/api/accounts/9999"}"""))
        )
    })
    public AccountResponse getAccount(@PathVariable @Parameter(description = "The unique identifier of the account", example = "1001") int id) {
        access.assertCanReadAccount(id);
        return AccountResponse.from(accountService.findById(id));
    }

    /**
     * GET /api/accounts/{id}/value-history?range=1M
     */
    @GetMapping("/{id}/value-history")
    @Operation(summary = "Get portfolio value history",
            description = "The account's value (cash plus holdings at recorded prices) over a range, oldest first, "
                    + "worked out from filled orders and recorded prices. In USD.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Value history retrieved"),
        @ApiResponse(responseCode = "400", description = "Unknown range"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public List<PortfolioValuePointResponse> getValueHistory(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1001") int id,
            @RequestParam(defaultValue = "1M") @Parameter(description = "One of 1D, 1W, 1M, 3M, 1Y") String range) {
        access.assertCanReadAccount(id);
        return portfolioHistoryService.valueHistory(id, ChartRanges.parse(range)).stream()
                .map(PortfolioValuePointResponse::from)
                .toList();
    }

    /**
     * POST /api/accounts/{id}/deposits
     */
    @PostMapping("/{id}/deposits")
    @Operation(summary = "Add cash",
            description = "Adds cash to the account (up to 1,000,000 at a time) and records the deposit. Only the "
                    + "account's trader (or the Super Admin) may add cash, and not while the account is frozen. In USD.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Cash added; returns the account with its new balance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AccountResponse.class))
        ),
        @ApiResponse(responseCode = "400", description = "Invalid amount, or the account is frozen"),
        @ApiResponse(responseCode = "403", description = "Not allowed to add cash to this account"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public AccountResponse deposit(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1001") int id,
            @Valid @RequestBody CashAmountRequest body) {
        access.assertCanTrade(id);
        return AccountResponse.from(accountService.deposit(id, body.amount()));
    }

    /**
     * POST /api/accounts/{id}/withdrawals
     */
    @PostMapping("/{id}/withdrawals")
    @Operation(summary = "Withdraw cash",
            description = "Takes cash out of the account and records the withdrawal, up to the whole balance. "
                    + "A pending buy left without the cash is rejected when it tries to fill. Only the account's "
                    + "trader (or the Super Admin) may withdraw, and not while the account is frozen. In USD.")
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "Cash withdrawn; returns the account with its new balance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = AccountResponse.class))
        ),
        @ApiResponse(responseCode = "400", description = "Invalid amount, more than the balance, or the account is frozen"),
        @ApiResponse(responseCode = "403", description = "Not allowed to withdraw from this account"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public AccountResponse withdraw(
            @PathVariable @Parameter(description = "The unique identifier of the account", example = "1001") int id,
            @Valid @RequestBody CashAmountRequest body) {
        access.assertCanTrade(id);
        return AccountResponse.from(accountService.withdraw(id, body.amount()));
    }
}
