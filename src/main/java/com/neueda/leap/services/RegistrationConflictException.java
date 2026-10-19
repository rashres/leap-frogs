package com.neueda.leap.services;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Sign-up with a username or email that is already taken. */
@ResponseStatus(HttpStatus.CONFLICT)
public class RegistrationConflictException extends RuntimeException {
    public RegistrationConflictException(String message) {
        super(message);
    }
}
