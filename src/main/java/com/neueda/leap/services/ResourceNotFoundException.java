package com.neueda.leap.services;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String resource, Object id) {
        super(resource + " " + id + " not found");
    }
}
