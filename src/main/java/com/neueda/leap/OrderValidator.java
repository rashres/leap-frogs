package com.neueda.leap;

/**
 * OrderValidator provides validation services for trade orders.
 * 
 * Think of this class as a "checker" that verifies if order information is correct
 * BEFORE you create an Order object. It catches problems early!
 * 
 * This class validates individual order fields and provides detailed
 * error messages. It can be used to validate order data before attempting
 * to create an Order object.
 * 
 * <h3>Validation Rules (What's Allowed):</h3>
 * <ul>
 *   <li><b>Symbol</b>: Must be non-null, non-empty, max 20 characters (e.g., "AAPL")</li>
 *   <li><b>Quantity</b>: Must be positive integer greater than 0 (e.g., 100 shares)</li>
 *   <li><b>Price</b>: Must be positive decimal greater than 0 (e.g., 150.50)</li>
 *   <li><b>TransactionType</b>: Must be "BUY" or "SELL" (case-insensitive)</li>
 *   <li><b>AccountId</b>: Must be positive integer greater than 0 (e.g., 12345)</li>
 * </ul>
 * 
 * <h3>How to Use:</h3>
 * <pre>
 * // Quick check - is everything valid?
 * if (OrderValidator.isValidOrder("AAPL", 100, 150.50, "BUY", 12345)) {
 *     // All good! Create the Order
 *     Order order = new Order("AAPL", 100, 150.50, "BUY", 12345);
 * } else {
 *     System.out.println("Order information is invalid!");
 * }
 * 
 * // Detailed check - what exactly is wrong?
 * OrderValidator.ValidationResult result = 
 *     OrderValidator.validateOrderWithDetails("AAPL", -50, 150.50, "BUY", 12345);
 * System.out.println(result.getReport());
 * // Output: ✗ Order validation failed: Quantity: must be positive...
 * </pre>
 */
public class OrderValidator {
    
    // Private constructor to prevent instantiation
    // WHY? This is a UTILITY class - you don't create instances of it.
    // You just call its static methods directly like: OrderValidator.isValidSymbol("AAPL")
    private OrderValidator() {
        throw new AssertionError("OrderValidator is a utility class and cannot be instantiated");
    }
    
    // ============ FIELD VALIDATION METHODS ============
    
    /**
     * Checks if a stock symbol is valid.
     * 
     * Valid means:
     * - It's not null (it exists)
     * - It's not empty (it has at least one character)
     * - It's not too long (20 characters max, like "INTERNATIONAL.COMPANY")
     * 
     * Examples:
     * - "AAPL" → true ✓ (valid)
     * - "" → false ✗ (empty)
     * - null → false ✗ (doesn't exist)
     * - "VERYLONGSYMBOLNAME12345" → false ✗ (too long, 24 chars)
     * 
     * @param symbol the symbol to validate (e.g., "AAPL", "GOOGL", "BRK.B")
     * @return true if valid, false otherwise
     */
    public static boolean isValidSymbol(String symbol) {
        // Check 1: Is it null? (does it exist?)
        if (symbol == null) {
            return false;
        }
        
        // Check 2: Is it empty or just whitespace?
        if (symbol.trim().isEmpty()) {
            return false;
        }
        
        // Check 3: Is it too long? (max 20 characters)
        if (symbol.length() > 20) {
            return false;
        }
        
        // If we got here, all checks passed!
        return true;
    }
    
    /**
     * Checks if an order quantity (number of shares) is valid.
     * 
     * Valid means: the quantity must be positive (greater than 0).
     * You can't buy or sell 0 shares or negative shares!
     * 
     * Examples:
     * - 100 → true ✓ (valid, you're buying 100 shares)
     * - 1 → true ✓ (valid, you're buying 1 share)
     * - 0 → false ✗ (invalid, must be at least 1)
     * - -50 → false ✗ (invalid, can't be negative)
     * 
     * @param quantity the number of shares (e.g., 100, 50, 1)
     * @return true if valid, false otherwise
     */
    public static boolean isValidQuantity(int quantity) {
        // Simple check: is it greater than zero?
        return quantity > 0;
    }
    
    /**
     * Checks if a price value is valid.
     * 
     * Valid means: the price must be positive (greater than 0).
     * You can't buy or sell at a negative price or zero price!
     * 
     * Examples:
     * - 150.50 → true ✓ (valid, $150.50 per share)
     * - 0.01 → true ✓ (valid, even very cheap prices work)
     * - 0.0 → false ✗ (invalid, must be at least 0.01)
     * - -50.00 → false ✗ (invalid, can't be negative)
     * 
     * @param price the price per share (e.g., 150.50, 25.99)
     * @return true if valid, false otherwise
     */
    public static boolean isValidPrice(double price) {
        // Simple check: is it greater than zero?
        return price > 0;
    }
    
    /**
     * Checks if a transaction type is valid.
     * 
     * Valid means: it must be either "BUY" or "SELL".
     * Case doesn't matter - "buy", "BUY", "Buy" all work!
     * 
     * Examples:
     * - "BUY" → true ✓ (valid, all caps)
     * - "buy" → true ✓ (valid, lowercase works too)
     * - "Buy" → true ✓ (valid, mixed case works too)
     * - "SELL" → true ✓ (valid)
     * - "sell" → true ✓ (valid, case-insensitive)
     * - "HOLD" → false ✗ (invalid, not BUY or SELL)
     * - null → false ✗ (invalid, doesn't exist)
     * - "" → false ✗ (invalid, empty)
     * 
     * @param transactionType the type of transaction (e.g., "BUY", "buy", "SELL")
     * @return true if valid, false otherwise
     */
    public static boolean isValidTransactionType(String transactionType) {
        // Check 1: Is it null or empty?
        if (transactionType == null || transactionType.trim().isEmpty()) {
            return false;
        }
        
        // Convert to uppercase so we can compare ("buy" becomes "BUY")
        String normalized = transactionType.trim().toUpperCase();
        
        // Check 2: Is it either "BUY" or "SELL"?
        return normalized.equals("BUY") || normalized.equals("SELL");
    }
    
    /**
     * Checks if an account ID is valid.
     * 
     * Valid means: the account ID must be positive (greater than 0).
     * Account IDs are positive numbers that identify your trading account.
     * 
     * Examples:
     * - 12345 → true ✓ (valid account ID)
     * - 1 → true ✓ (valid, even small IDs work)
     * - 0 → false ✗ (invalid, must be at least 1)
     * - -100 → false ✗ (invalid, can't be negative)
     * 
     * @param accountId the trading account ID (e.g., 12345, 54321)
     * @return true if valid, false otherwise
     */
    public static boolean isValidAccountId(int accountId) {
        // Simple check: is it greater than zero?
        return accountId > 0;
    }
    
    // ============ COMPREHENSIVE VALIDATION METHODS ============
    
    /**
     * Checks if ALL order fields together are valid.
     * 
     * This is a convenience method that checks everything at once.
     * It returns true only if ALL fields pass validation:
     * - symbol is valid
     * - quantity is valid
     * - price is valid
     * - transactionType is valid
     * - accountId is valid
     * 
     * If ANY field is invalid, this returns false.
     * 
     * Example:
     * <pre>
     * if (OrderValidator.isValidOrder("AAPL", 100, 150.50, "BUY", 12345)) {
     *     System.out.println("Great! All order fields are valid.");
     * } else {
     *     System.out.println("Oops! Something is wrong with the order.");
     * }
     * </pre>
     * 
     * @param symbol the stock symbol
     * @param quantity the order quantity
     * @param price the price per share
     * @param transactionType the transaction type ("BUY" or "SELL")
     * @param accountId the account ID
     * @return true if ALL fields are valid, false if ANY field is invalid
     */
    public static boolean isValidOrder(String symbol, int quantity, double price, 
                                       String transactionType, int accountId) {
        // Check each field using the individual validation methods
        // ALL must pass (that's what && means - AND)
        return isValidSymbol(symbol)
                && isValidQuantity(quantity)
                && isValidPrice(price)
                && isValidTransactionType(transactionType)
                && isValidAccountId(accountId);
    }
    
    // ============ DETAILED VALIDATION ERROR REPORTING ============
    
    /**
     * Validates all order fields and returns DETAILED error messages.
     * 
     * Use this method when you want to know EXACTLY what's wrong with the order.
     * It checks all fields and collects ALL errors (not just the first one).
     * 
     * Example:
     * <pre>
     * OrderValidator.ValidationResult result = 
     *     OrderValidator.validateOrderWithDetails("AAPL", -50, 0.0, "HOLD", 0);
     * 
     * if (result.isValid()) {
     *     // No errors, create the Order
     * } else {
     *     // Show user what's wrong:
     *     System.out.println(result.getReport());
     *     // Prints:
     *     // ✗ Order validation failed:
     *     // Quantity: must be a positive integer (greater than 0)
     *     // Price: must be a positive decimal (greater than 0)
     *     // TransactionType: must be 'BUY' or 'SELL'
     *     // AccountId: must be a positive integer (greater than 0)
     * }
     * </pre>
     * 
     * @param symbol the stock symbol
     * @param quantity the order quantity
     * @param price the price per share
     * @param transactionType the transaction type ("BUY" or "SELL")
     * @param accountId the account ID
     * @return a ValidationResult object that tells you if it's valid and what's wrong
     */
    public static ValidationResult validateOrderWithDetails(String symbol, int quantity, double price,
                                                            String transactionType, int accountId) {
        // Create a new result object to collect all errors
        ValidationResult result = new ValidationResult();
        
        // Check each field and add an error message if it fails
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
        
        // Return the result with all errors collected
        return result;
    }
    
    // ============ VALIDATION RESULT CLASS ============
    
    /**
     * Inner class to hold validation results with error messages.
     * 
     * Think of this as a "report card" that tells you:
     * 1. Is the order valid? (yes/no)
     * 2. If not, what's wrong? (detailed error messages)
     * 
     * You get one of these back from validateOrderWithDetails().
     * Then you can ask it questions about the validation.
     */
    public static class ValidationResult {
        // Is the order valid? (true if no errors, false if any errors)
        private boolean isValid;
        // What errors did we find? (stored as text)
        private StringBuilder errors;
        
        /**
         * Constructs a new ValidationResult.
         * 
         * By default, it starts as valid (no errors found yet).
         * When we find problems, we add errors and mark it as invalid.
         */
        public ValidationResult() {
            this.isValid = true;  // Start optimistic - assume it's valid
            this.errors = new StringBuilder();  // Start with no errors
        }
        
        /**
         * Adds an error message to this result.
         * 
         * When we find a problem, we:
         * 1. Mark this result as invalid (isValid = false)
         * 2. Add the error message to our collection
         * 
         * @param error the error message (e.g., "Quantity must be positive")
         */
        private void addError(String error) {
            // We found a problem, so mark as invalid
            this.isValid = false;
            
            // If we already have errors, add a separator before the new one
            if (errors.length() > 0) {
                errors.append("; ");  // Semicolon separates multiple errors
            }
            
            // Add the new error message
            errors.append(error);
        }
        
        /**
         * Checks if the order is valid (has no errors).
         * 
         * @return true if validation passed (no errors), false if there are any errors
         */
        public boolean isValid() {
            return isValid;
        }
        
        /**
         * Gets ALL error messages as a single string.
         * 
         * Multiple errors are separated by semicolons (;).
         * 
         * Example output:
         * "Quantity: must be positive; Price: must be positive"
         * 
         * @return all error messages joined together, or empty string if valid
         */
        public String getErrors() {
            return errors.toString();
        }
        
        /**
         * Gets a human-readable validation report.
         * 
         * This is the nicest way to display results to a user.
         * It includes a checkmark (✓) if valid, or an X mark (✗) if invalid.
         * 
         * Example valid output:
         * "✓ Order is valid"
         * 
         * Example invalid output:
         * "✗ Order validation failed:
         *  Quantity: must be positive; Price: must be positive"
         * 
         * @return a pretty-printed validation report
         */
        public String getReport() {
            if (isValid) {
                return "✓ Order is valid";  // Good news!
            } else {
                return "✗ Order validation failed:\n" + getErrors();  // Bad news with details
            }
        }
        
        /**
         * Converts this result to a string.
         * 
         * This is called automatically when you print the result:
         * System.out.println(result);
         * 
         * It just returns the same thing as getReport().
         * 
         * @return a pretty-printed validation report
         */
        @Override
        public String toString() {
            return getReport();
        }
    }
}

