package com.neueda.leap;

/**
 * Order class represents a trade order in the leap-frogs trading system.
 * 
 * This class validates order details including:
 * - Symbol (stock ticker)
 * - Quantity (shares to trade)
 * - Price (per share)
 * - Transaction type (BUY or SELL)
 * - Account ID (trader's account)
 * 
 * All orders must pass validation before being processed.
 */
public class Order {
    
    // Private fields following camelCase naming convention
    private String symbol;
    private int quantity;
    private double price;
    private String transactionType;
    private int accountId;
    
    /**
     * Constructor for creating an Order with validation.
     * 
     * @param symbol the stock ticker symbol (e.g., "AAPL", "GOOGL")
     * @param quantity the number of shares to trade (must be positive)
     * @param price the price per share (must be positive)
     * @param transactionType the type of transaction ("BUY" or "SELL")
     * @param accountId the account ID of the trader (must be positive)
     * 
     * @throws IllegalArgumentException if any parameter fails validation
     */
    public Order(String symbol, int quantity, double price, String transactionType, int accountId) {
        // Validate all inputs before assigning to fields
        this.symbol = validateSymbol(symbol);
        this.quantity = validateQuantity(quantity);
        this.price = validatePrice(price);
        this.transactionType = validateTransactionType(transactionType);
        this.accountId = validateAccountId(accountId);
    }
    
    /**
     * Validates the stock symbol.
     * 
     * @param symbol the symbol to validate
     * @return the validated symbol
     * @throws IllegalArgumentException if symbol is null, empty, or invalid
     */
    private String validateSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new IllegalArgumentException("Symbol cannot be null or empty");
        }
        if (symbol.length() > 20) {
            throw new IllegalArgumentException("Symbol cannot exceed 20 characters");
        }
        return symbol.trim().toUpperCase();
    }
    
    /**
     * Validates the order quantity.
     * 
     * @param quantity the quantity to validate
     * @return the validated quantity
     * @throws IllegalArgumentException if quantity is not positive
     */
    private int validateQuantity(int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive (greater than 0)");
        }
        return quantity;
    }
    
    /**
     * Validates the price per share.
     * 
     * @param price the price to validate
     * @return the validated price
     * @throws IllegalArgumentException if price is not positive
     */
    private double validatePrice(double price) {
        if (price <= 0) {
            throw new IllegalArgumentException("Price must be positive (greater than 0)");
        }
        return price;
    }
    
    /**
     * Validates the transaction type.
     * Only "BUY" and "SELL" are valid transaction types.
     * 
     * @param transactionType the transaction type to validate
     * @return the validated and normalized transaction type
     * @throws IllegalArgumentException if transaction type is not "BUY" or "SELL"
     */
    private String validateTransactionType(String transactionType) {
        if (transactionType == null || transactionType.trim().isEmpty()) {
            throw new IllegalArgumentException("Transaction type cannot be null or empty");
        }
        
        String normalized = transactionType.trim().toUpperCase();
        
        if (!normalized.equals("BUY") && !normalized.equals("SELL")) {
            throw new IllegalArgumentException("Transaction type must be 'BUY' or 'SELL', got: " + transactionType);
        }
        
        return normalized;
    }
    
    /**
     * Validates the account ID.
     * 
     * @param accountId the account ID to validate
     * @return the validated account ID
     * @throws IllegalArgumentException if account ID is not positive
     */
    private int validateAccountId(int accountId) {
        if (accountId <= 0) {
            throw new IllegalArgumentException("Account ID must be positive (greater than 0)");
        }
        return accountId;
    }
    
    /**
     * Checks if this order is valid.
     * This method allows for checking validity without throwing exceptions.
     * 
     * @return true if all fields are valid, false otherwise
     */
    public boolean isValid() {
        try {
            // All fields should already be validated by constructor
            // This method provides a way to check validity without exceptions
            return symbol != null && !symbol.isEmpty()
                    && quantity > 0
                    && price > 0
                    && (transactionType.equals("BUY") || transactionType.equals("SELL"))
                    && accountId > 0;
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Calculates the total transaction amount (quantity × price).
     * 
     * @return the total amount for this order
     */
    public double calculateAmount() {
        return quantity * price;
    }
    
    // ============ Getters and Setters ============
    
    /**
     * Gets the stock symbol.
     * 
     * @return the symbol
     */
    public String getSymbol() {
        return symbol;
    }
    
    /**
     * Gets the order quantity.
     * 
     * @return the quantity
     */
    public int getQuantity() {
        return quantity;
    }
    
    /**
     * Gets the price per share.
     * 
     * @return the price
     */
    public double getPrice() {
        return price;
    }
    
    /**
     * Gets the transaction type.
     * 
     * @return the transaction type ("BUY" or "SELL")
     */
    public String getTransactionType() {
        return transactionType;
    }
    
    /**
     * Gets the account ID.
     * 
     * @return the account ID
     */
    public int getAccountId() {
        return accountId;
    }
    
    /**
     * String representation of the Order.
     * 
     * @return a formatted string describing the order
     */
    @Override
    public String toString() {
        return String.format(
            "Order{" +
            "symbol='%s'" +
            ", quantity=%d" +
            ", price=%.2f" +
            ", amount=%.2f" +
            ", transactionType='%s'" +
            ", accountId=%d" +
            "}",
            symbol, quantity, price, calculateAmount(), transactionType, accountId
        );
    }
    
    /**
     * Checks equality based on order details.
     * 
     * @param obj the object to compare
     * @return true if orders have the same details
     */
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        Order other = (Order) obj;
        return symbol.equals(other.symbol)
                && quantity == other.quantity
                && Double.compare(price, other.price) == 0
                && transactionType.equals(other.transactionType)
                && accountId == other.accountId;
    }
    
    /**
     * Generates hash code based on order details.
     * 
     * @return the hash code
     */
    @Override
    public int hashCode() {
        int result = 31;
        result = 31 * result + symbol.hashCode();
        result = 31 * result + Integer.hashCode(quantity);
        result = 31 * result + Double.hashCode(price);
        result = 31 * result + transactionType.hashCode();
        result = 31 * result + Integer.hashCode(accountId);
        return result;
    }
}
