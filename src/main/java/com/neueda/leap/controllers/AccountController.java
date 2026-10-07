package com.neueda.leap.controllers;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.neueda.leap.controllers.dto.AccountResponse;
import com.neueda.leap.controllers.dto.PortfolioValuePointResponse;
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

/**
 * REST API Controller for Accounts (read-only for now)
 */
@RestController
@RequestMapping("/accounts")
@CrossOrigin(origins = "*")
@Tag(name = "Accounts", description = "Account endpoints")
public class AccountController {

    private final AccountService accountService;
    private final PortfolioHistoryService portfolioHistoryService;

    public AccountController(AccountService accountService, PortfolioHistoryService portfolioHistoryService) {
        this.accountService = accountService;
        this.portfolioHistoryService = portfolioHistoryService;
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
        return portfolioHistoryService.valueHistory(id, ChartRanges.parse(range)).stream()
                .map(PortfolioValuePointResponse::from)
                .toList();
    }
}
