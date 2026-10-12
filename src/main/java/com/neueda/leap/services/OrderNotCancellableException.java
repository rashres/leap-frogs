package com.neueda.leap.services;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Only a PENDING order can be cancelled; one that has filled, failed, expired or been cancelled cannot. */
@ResponseStatus(HttpStatus.CONFLICT)
public class OrderNotCancellableException extends RuntimeException {
    public OrderNotCancellableException(int orderId, String status) {
        super("Order " + orderId + " is " + status + " and can no longer be cancelled");
    }
}
