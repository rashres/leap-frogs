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
    
    // ============ FUND VERIFICATION METHODS ============
    
    // Verifies account has sufficient cash to buy
    public static boolean isValidCashBalance(Account account, BigDecimal quantity, BigDecimal price) {
        if (account == null) {
            return false;
        }
        BigDecimal requiredCash = quantity.multiply(price);
        BigDecimal availableCash = account.getCashBalance();
        return availableCash != null && availableCash.compareTo(requiredCash) >= 0;
    }
    
    // Verifies account has sufficient shares to sell
    public static boolean hasEnoughShares(Account account, Instrument instrument, BigDecimal quantity) {
        if (account == null || instrument == null) {
            return false;
        }
        Holding holding = account.getHolding(instrument);
        if (holding == null) {
            return false;
        }
        BigDecimal availableShares = holding.getQuantity();
        return availableShares != null && availableShares.compareTo(quantity) >= 0;
    }
    
    // ============ COMPREHENSIVE VALIDATION METHODS ============
    
    // Validates all order fields at once: returns true only if ALL are valid
    public static boolean isValidOrder(Order order) {
        if (order == null) {
            return false;
        }

        String symbol = order.getInstrument().getSymbol();
        BigDecimal quantity = order.getQuantity();
        BigDecimal price = order.getPrice();
        String transactionType = order.getSide();
        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();

        // Validate basic order fields
        if (!isValidSymbol(symbol)
                || !isValidQuantity(quantity)
                || !isValidPrice(price.doubleValue())
                || !isValidTransactionType(transactionType)) {
            return false;
        }

        // Validate sufficient funds/shares
        if ("BUY".equalsIgnoreCase(transactionType)) {
            return isValidCashBalance(account, quantity, price);
        } else if ("SELL".equalsIgnoreCase(transactionType)) {
            return hasEnoughShares(account, instrument, quantity);
        }

        return false;
    }
    
    // ============ DETAILED VALIDATION ERROR REPORTING ============
    
    // Validates all order fields including funds and collects detailed error messages
    public static ValidationResult validateOrderWithDetails(Order order) {
        ValidationResult result = new ValidationResult();
        
        if (order == null) {
            result.addError("Order: cannot be null");
            return result;
        }

        String symbol = order.getInstrument().getSymbol();
        BigDecimal quantity = order.getQuantity();
        BigDecimal price = order.getPrice();
        String transactionType = order.getSide();
        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();

        // Validate basic fields
        if (!isValidSymbol(symbol)) {
            result.addError("Symbol: must be non-null, non-empty, and max 20 characters");
        }
        if (!isValidQuantity(quantity)) {
            result.addError("Quantity: must be a positive value (greater than 0)");
        }
        if (!isValidPrice(price.doubleValue())) {
            result.addError("Price: must be a positive decimal (greater than 0)");
        }
        if (!isValidTransactionType(transactionType)) {
            result.addError("TransactionType: must be 'BUY' or 'SELL'");
        }

        // Validate funds based on transaction type
        if ("BUY".equalsIgnoreCase(transactionType)) {
            if (!isValidCashBalance(account, quantity, price)) {
                result.addError("Insufficient cash: required " + quantity.multiply(price) 
                    + ", available " + (account != null ? account.getCashBalance() : "N/A"));
            }
        } else if ("SELL".equalsIgnoreCase(transactionType)) {
            if (!hasEnoughShares(account, instrument, quantity)) {
                Holding holding = account != null ? account.getHolding(instrument) : null;
                result.addError("Insufficient shares: required " + quantity 
                    + ", available " + (holding != null ? holding.getQuantity() : "0"));
            }
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

