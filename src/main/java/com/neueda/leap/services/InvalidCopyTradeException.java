package com.neueda.leap.services;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidCopyTradeException extends RuntimeException {
    public InvalidCopyTradeException(String message) {
        super(message);
    }
}
