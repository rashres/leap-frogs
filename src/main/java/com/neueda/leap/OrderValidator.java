package com.neueda.leap;

import java.math.BigDecimal;

// Utility class for validating trade order fields and generating detailed error reports
public class OrderValidator {
    
    // Utility class - cannot instantiate
    private OrderValidator() {
        throw new AssertionError("OrderValidator is a utility class and cannot be instantiated");
    }
    
    // ============ FIELD VALIDATION METHODS ============
    
    // Validates symbol: non-null, non-empty, max 20 characters
    public static boolean isValidSymbol(String symbol) {
        return symbol != null && !symbol.trim().isEmpty() && symbol.length() <= 20;
    }
    
    // Validates quantity: must be positive (> 0)
    public static boolean isValidQuantity(BigDecimal quantity) {
        BigDecimal zero = new BigDecimal("0");
        int result = quantity.compareTo(zero);
        return result > 0;
    }
    
    // Validates price: must be positive (> 0)
    public static boolean isValidPrice(double price) {
        return price > 0;
    }
    
    // Validates transaction type: must be "BUY" or "SELL" (case-insensitive)
    public static boolean isValidTransactionType(String transactionType) {
        if (transactionType == null || transactionType.trim().isEmpty()) {
            return false;
        }
        String normalized = transactionType.trim().toUpperCase();
        return normalized.equals("BUY") || normalized.equals("SELL");
    }
    
    // Validates account ID: must be positive (> 0)
    public static boolean isValidAccountId(int accountId) {
        return accountId > 0;
    }
    
    // ============ COMPREHENSIVE VALIDATION METHODS ============
    
    // Validates all order fields at once: returns true only if ALL are valid
    public static boolean isValidOrder(Order order) {

        String symbol = order.getInstrument().getSymbol();
        BigDecimal quantity = order.getQuantity();
        double price = order.getPrice().doubleValue();
        String transactionType = order.getSide();
        //int accountId = order.getAccount().getAccountId();

        return isValidSymbol(symbol)
                && isValidQuantity(quantity)
                && isValidPrice(price)
                && isValidTransactionType(transactionType);
                //&& isValidAccountId(accountId);
    }
    
    // ============ DETAILED VALIDATION ERROR REPORTING ============
    
    // Validates all order fields and collects detailed error messages
    public static ValidationResult validateOrderWithDetails(String symbol, BigDecimal quantity, double price,
                                                            String transactionType, int accountId) {
        ValidationResult result = new ValidationResult();
        if (!isValidSymbol(symbol)) {
            result.addError("Symbol: must be non-null, non-empty, and max 20 characters");
        }
        if (!isValidQuantity(quantity)) {
            result.addError("Quantity: must be a positive integer (greater than 0)");
        }
        if (!isValidPrice(price)) {
            result.addError("Price: must be a positive decimal (greater than 0)");
        }
        if (!isValidTransactionType(transactionType)) {
            result.addError("TransactionType: must be 'BUY' or 'SELL'");
        }
        if (!isValidAccountId(accountId)) {
            result.addError("AccountId: must be a positive integer (greater than 0)");
        }
        return result;
    }
    
    // ============ VALIDATION RESULT CLASS ============
    
    // Holds validation status and error messages
    public static class ValidationResult {
        private boolean isValid;
        private StringBuilder errors;
        
        // Constructs new ValidationResult (starts as valid)
        public ValidationResult() {
            this.isValid = true;
            this.errors = new StringBuilder();
        }
        
        // Adds error message and marks result as invalid
        private void addError(String error) {
            this.isValid = false;
            if (errors.length() > 0) {
                errors.append("; ");
            }
            errors.append(error);
        }
        
        // Returns true if validation passed (no errors)
        public boolean isValid() {
            return isValid;
        }
        
        // Returns all error messages (separated by semicolons)
        public String getErrors() {
            return errors.toString();
        }
        
        // Returns human-readable validation report with ✓ or ✗
        public String getReport() {
            if (isValid) {
                return "✓ Order is valid";
            } else {
                return "✗ Order validation failed:\n" + getErrors();
            }
        }
        
        // Returns validation report
        @Override
        public String toString() {
            return getReport();
        }
    }
}

