package com.neueda.leap.services;

/** Caller is authenticated but not permitted for this resource or action. */
public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException(String message) {
        super(message);
    }
}
