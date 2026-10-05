package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.HoldingResponse;
import com.neueda.leap.services.HoldingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Controller for an account's holdings (all markets in one list)
 */
@RestController
@RequestMapping("/accounts/{accountId}/holdings")
@CrossOrigin(origins = "*")
@Tag(name = "Holdings", description = "Holdings endpoints")
public class HoldingController {

    private final HoldingService holdingService;

    public HoldingController(HoldingService holdingService) {
        this.holdingService = holdingService;
    }

    /**
     * GET /api/accounts/{accountId}/holdings
     */
    @GetMapping
    @Operation(summary = "List holdings", description = "Returns every instrument the account currently owns, across all exchanges")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Holdings retrieved (empty list if the account owns nothing)"),
        @ApiResponse(responseCode = "404", description = "Account not found")
    })
    public List<HoldingResponse> getHoldings(@PathVariable @Parameter(description = "The unique identifier of the account", example = "1") int accountId) {
        return holdingService.findByAccountId(accountId).stream()
                .map(HoldingResponse::from)
                .toList();
    }
}
