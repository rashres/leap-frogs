package com.neueda.leap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the Order class.
 * 
 * Tests validate:
 * - Constructor parameter validation
 * - Business rule enforcement
 * - Exception handling
 * - Calculation accuracy
 * - Object equality and hashing
 */
@DisplayName("Order Validation Tests")
public class OrderTest {
    
    // ============ VALID ORDER TESTS ============
    
    @Test
    @DisplayName("Should create valid BUY order with all correct parameters")
    void testCreateValidBuyOrder() {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.50, "BUY", 1001);
        
        // Assert
        assertNotNull(order, "Order should be created successfully");
        assertEquals("AAPL", order.getSymbol());
        assertEquals(100, order.getQuantity());
        assertEquals(150.50, order.getPrice());
        assertEquals("BUY", order.getTransactionType());
        assertEquals(1001, order.getAccountId());
        assertTrue(order.isValid(), "Order should be valid");
    }
    
    @Test
    @DisplayName("Should create valid SELL order with all correct parameters")
    void testCreateValidSellOrder() {
        // Arrange & Act
        Order order = new Order("GOOGL", 50, 2800.75, "SELL", 1002);
        
        // Assert
        assertEquals("GOOGL", order.getSymbol());
        assertEquals(50, order.getQuantity());
        assertEquals(2800.75, order.getPrice());
        assertEquals("SELL", order.getTransactionType());
        assertEquals(1002, order.getAccountId());
        assertTrue(order.isValid());
    }
    
    // ============ SYMBOL VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should throw exception when symbol is null")
    void testNullSymbolThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order(null, 100, 150.0, "BUY", 1001),
            "Should throw IllegalArgumentException for null symbol"
        );
        
        assertTrue(exception.getMessage().contains("Symbol cannot be null"));
    }
    
    @Test
    @DisplayName("Should throw exception when symbol is empty")
    void testEmptySymbolThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("", 100, 150.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Symbol cannot be null or empty"));
    }
    
    @Test
    @DisplayName("Should throw exception when symbol exceeds 20 characters")
    void testSymbolExceedsMaxLengthThrowsException() {
        // Arrange
        String longSymbol = "THISISTOOLONG123456789";
        
        // Act & Assert
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order(longSymbol, 100, 150.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("exceed 20 characters"));
    }
    
    @Test
    @DisplayName("Should normalize symbol to uppercase")
    void testSymbolNormalizedToUppercase() {
        // Arrange & Act
        Order order = new Order("aapl", 100, 150.0, "BUY", 1001);
        
        // Assert
        assertEquals("AAPL", order.getSymbol(), "Symbol should be converted to uppercase");
    }
    
    // ============ QUANTITY VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should throw exception when quantity is zero")
    void testZeroQuantityThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 0, 150.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Quantity must be positive"));
    }
    
    @Test
    @DisplayName("Should throw exception when quantity is negative")
    void testNegativeQuantityThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", -100, 150.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Quantity must be positive"));
    }
    
    @ParameterizedTest
    @ValueSource(ints = {1, 10, 100, 1000, 1000000})
    @DisplayName("Should accept positive quantities")
    void testPositiveQuantitiesAccepted(int quantity) {
        // Arrange & Act
        Order order = new Order("AAPL", quantity, 150.0, "BUY", 1001);
        
        // Assert
        assertEquals(quantity, order.getQuantity());
    }
    
    // ============ PRICE VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should throw exception when price is zero")
    void testZeroPriceThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 0.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Price must be positive"));
    }
    
    @Test
    @DisplayName("Should throw exception when price is negative")
    void testNegativePriceThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, -50.0, "BUY", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Price must be positive"));
    }
    
    @ParameterizedTest
    @ValueSource(doubles = {0.01, 10.50, 100.99, 2500.00, 9999.99})
    @DisplayName("Should accept positive prices")
    void testPositivePricesAccepted(double price) {
        // Arrange & Act
        Order order = new Order("AAPL", 100, price, "BUY", 1001);
        
        // Assert
        assertEquals(price, order.getPrice());
    }
    
    // ============ TRANSACTION TYPE VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should throw exception when transaction type is null")
    void testNullTransactionTypeThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 150.0, null, 1001)
        );
        
        assertTrue(exception.getMessage().contains("Transaction type cannot be null or empty"));
    }
    
    @Test
    @DisplayName("Should throw exception when transaction type is empty")
    void testEmptyTransactionTypeThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 150.0, "", 1001)
        );
        
        assertTrue(exception.getMessage().contains("Transaction type cannot be null or empty"));
    }
    
    @Test
    @DisplayName("Should throw exception for invalid transaction type")
    void testInvalidTransactionTypeThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 150.0, "INVALID", 1001)
        );
        
        assertTrue(exception.getMessage().contains("must be 'BUY' or 'SELL'"));
    }
    
    @Test
    @DisplayName("Should normalize transaction type to uppercase")
    void testTransactionTypeNormalizedToUppercase() {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.0, "buy", 1001);
        
        // Assert
        assertEquals("BUY", order.getTransactionType());
    }
    
    @ParameterizedTest
    @ValueSource(strings = {"BUY", "SELL", "buy", "sell", "Buy", "Sell"})
    @DisplayName("Should accept valid transaction types (case-insensitive)")
    void testValidTransactionTypesAccepted(String transactionType) {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.0, transactionType, 1001);
        
        // Assert
        assertTrue(order.getTransactionType().equals("BUY") || order.getTransactionType().equals("SELL"));
    }
    
    // ============ ACCOUNT ID VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should throw exception when account ID is zero")
    void testZeroAccountIdThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 150.0, "BUY", 0)
        );
        
        assertTrue(exception.getMessage().contains("Account ID must be positive"));
    }
    
    @Test
    @DisplayName("Should throw exception when account ID is negative")
    void testNegativeAccountIdThrowsException() {
        // Assert & Act
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> new Order("AAPL", 100, 150.0, "BUY", -1001)
        );
        
        assertTrue(exception.getMessage().contains("Account ID must be positive"));
    }
    
    @ParameterizedTest
    @ValueSource(ints = {1, 100, 1000, 9999, 1000000})
    @DisplayName("Should accept positive account IDs")
    void testPositiveAccountIdsAccepted(int accountId) {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.0, "BUY", accountId);
        
        // Assert
        assertEquals(accountId, order.getAccountId());
    }
    
    // ============ CALCULATION TESTS ============
    
    @Test
    @DisplayName("Should calculate amount correctly (quantity × price)")
    void testCalculateAmountCorrectly() {
        // Arrange
        Order order = new Order("AAPL", 100, 150.50, "BUY", 1001);
        
        // Act
        double amount = order.calculateAmount();
        
        // Assert
        assertEquals(15050.0, amount, 0.01, "Amount should be quantity × price");
    }
    
    @Test
    @DisplayName("Should calculate decimal prices accurately")
    void testCalculateAmountWithDecimals() {
        // Arrange
        Order order = new Order("MSFT", 50, 200.75, "SELL", 1002);
        
        // Act
        double amount = order.calculateAmount();
        
        // Assert
        assertEquals(10037.50, amount, 0.01);
    }
    
    // ============ VALIDATION STATE TESTS ============
    
    @Test
    @DisplayName("isValid() should return true for valid orders")
    void testIsValidReturnsTrueForValidOrder() {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.0, "BUY", 1001);
        
        // Assert
        assertTrue(order.isValid(), "Valid order should return true");
    }
    
    // ============ EQUALITY AND HASH CODE TESTS ============
    
    @Test
    @DisplayName("Two orders with same details should be equal")
    void testOrderEqualityWithSameDetails() {
        // Arrange
        Order order1 = new Order("AAPL", 100, 150.0, "BUY", 1001);
        Order order2 = new Order("AAPL", 100, 150.0, "BUY", 1001);
        
        // Assert
        assertEquals(order1, order2, "Orders with identical details should be equal");
    }
    
    @Test
    @DisplayName("Two orders with different details should not be equal")
    void testOrderInequalityWithDifferentDetails() {
        // Arrange
        Order order1 = new Order("AAPL", 100, 150.0, "BUY", 1001);
        Order order2 = new Order("GOOGL", 100, 150.0, "BUY", 1001);
        
        // Assert
        assertNotEquals(order1, order2, "Orders with different details should not be equal");
    }
    
    @Test
    @DisplayName("Order should have consistent hash code")
    void testOrderHashCodeConsistency() {
        // Arrange
        Order order = new Order("AAPL", 100, 150.0, "BUY", 1001);
        int hashCode1 = order.hashCode();
        int hashCode2 = order.hashCode();
        
        // Assert
        assertEquals(hashCode1, hashCode2, "Hash code should be consistent");
    }
    
    @Test
    @DisplayName("Equal orders should have equal hash codes")
    void testEqualOrdersHaveSameHashCode() {
        // Arrange
        Order order1 = new Order("AAPL", 100, 150.0, "BUY", 1001);
        Order order2 = new Order("AAPL", 100, 150.0, "BUY", 1001);
        
        // Assert
        assertEquals(order1.hashCode(), order2.hashCode(), "Equal orders should have equal hash codes");
    }
    
    // ============ STRING REPRESENTATION TESTS ============
    
    @Test
    @DisplayName("toString() should provide complete order information")
    void testToStringContainsAllOrderDetails() {
        // Arrange & Act
        Order order = new Order("AAPL", 100, 150.0, "BUY", 1001);
        String orderString = order.toString();
        
        // Assert
        assertTrue(orderString.contains("AAPL"), "Should contain symbol");
        assertTrue(orderString.contains("100"), "Should contain quantity");
        assertTrue(orderString.contains("150.00"), "Should contain price");
        assertTrue(orderString.contains("15000.00"), "Should contain amount");
        assertTrue(orderString.contains("BUY"), "Should contain transaction type");
        assertTrue(orderString.contains("1001"), "Should contain account ID");
    }
}
