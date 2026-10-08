package com.neueda.leap.controllers;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit")
@CrossOrigin(origins = "*")
@Tag(name = "Audit", description = "Auditing endpoints")
public class AuditController {
}
