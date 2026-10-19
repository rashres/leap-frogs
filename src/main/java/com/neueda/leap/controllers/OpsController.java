package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.AccountResponse;
import com.neueda.leap.controllers.dto.FreezeRequest;
import com.neueda.leap.services.OpsAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ops")
@Tag(name = "Operations", description = "Trading operations: account search and freeze/unfreeze")
public class OpsController {

    private final OpsAccountService ops;

    public OpsController(OpsAccountService ops) {
        this.ops = ops;
    }

    @GetMapping("/accounts")
    @Operation(summary = "Search trading accounts")
    public List<AccountResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status) {
        return ops.search(q, status).stream().map(AccountResponse::from).toList();
    }

    @PostMapping("/accounts/{id}/freeze")
    @Operation(summary = "Freeze a trading account")
    public AccountResponse freeze(@PathVariable int id, @Valid @RequestBody FreezeRequest body) {
        return AccountResponse.from(ops.freeze(id, body.reason()));
    }

    @PostMapping("/accounts/{id}/unfreeze")
    @Operation(summary = "Unfreeze a trading account")
    public AccountResponse unfreeze(@PathVariable int id) {
        return AccountResponse.from(ops.unfreeze(id));
    }

    @GetMapping("/accounts/{id}/status-events")
    @Operation(summary = "Recent freeze/unfreeze events for an account")
    public List<Map<String, Object>> statusEvents(@PathVariable int id) {
        return ops.statusEvents(id);
    }
}
