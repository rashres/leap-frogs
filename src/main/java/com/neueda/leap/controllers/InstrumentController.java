package com.neueda.leap.controllers;

import com.neueda.leap.controllers.dto.InstrumentResponse;
import com.neueda.leap.services.InstrumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API Controller for Instruments (stocks in the database)
 */
@RestController
@RequestMapping("/instruments")
@CrossOrigin(origins = "*")
@Tag(name = "Instruments", description = "Instrument endpoints")
public class InstrumentController {

    private final InstrumentService instrumentService;

    public InstrumentController(InstrumentService instrumentService) {
        this.instrumentService = instrumentService;
    }

    /**
     * GET /api/instruments
     */
    @GetMapping
    @Operation(summary = "List instruments", description = "Returns all instruments with their exchange")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Instruments retrieved")
    })
    public List<InstrumentResponse> getAllInstruments() {
        return instrumentService.findAll().stream()
                .map(InstrumentResponse::from)
                .toList();
    }

    /**
     * GET /api/instruments/{id}
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get instrument", description = "Returns one instrument by its id")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Instrument found"),
        @ApiResponse(responseCode = "404", description = "Instrument not found")
    })
    public InstrumentResponse getInstrument(@PathVariable @Parameter(description = "The unique identifier of the instrument") int id) {
        return InstrumentResponse.from(instrumentService.findById(id));
    }
}
