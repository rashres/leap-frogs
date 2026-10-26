package com.neueda.leap.services;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** A deposit or withdrawal that cannot go through: bad amount, frozen account, or not enough cash. */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidCashException extends RuntimeException {
    public InvalidCashException(String message) {
        super(message);
    }
}
