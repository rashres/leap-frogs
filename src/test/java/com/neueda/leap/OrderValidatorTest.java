package com.neueda.leap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the OrderValidator class.
 * 
 * Tests validate:
 * - Individual field validation methods
 * - Comprehensive order validation
 * - Detailed error reporting
 * - Edge cases and boundary conditions
 */
@DisplayName("OrderValidator Tests")
public class OrderValidatorTest {
    
    // ============ SYMBOL VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for valid symbol")
    void testValidSymbol() {
        assertTrue(OrderValidator.isValidSymbol("AAPL"));
        assertTrue(OrderValidator.isValidSymbol("GOOGL"));
        assertTrue(OrderValidator.isValidSymbol("msft")); // Case doesn't matter for validation
    }
    
    @Test
    @DisplayName("Should return false for null symbol")
    void testNullSymbolIsInvalid() {
        assertFalse(OrderValidator.isValidSymbol(null));
    }
    
    @Test
    @DisplayName("Should return false for empty symbol")
    void testEmptySymbolIsInvalid() {
        assertFalse(OrderValidator.isValidSymbol(""));
        assertFalse(OrderValidator.isValidSymbol("   "));
    }
    
    @Test
    @DisplayName("Should return false for symbol exceeding 20 characters")
    void testSymbolTooLongIsInvalid() {
        assertFalse(OrderValidator.isValidSymbol("THISSYMBOLISWAYTOOLONG"));
    }
    
    @Test
    @DisplayName("Should return true for symbol exactly 20 characters")
    void testSymbolMaxLengthIsValid() {
        assertTrue(OrderValidator.isValidSymbol("12345678901234567890"));
    }
    
    // ============ QUANTITY VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for positive quantity")
    void testPositiveQuantityIsValid() {
        assertTrue(OrderValidator.isValidQuantity(1));
        assertTrue(OrderValidator.isValidQuantity(100));
        assertTrue(OrderValidator.isValidQuantity(1000000));
    }
    
    @Test
    @DisplayName("Should return false for zero quantity")
    void testZeroQuantityIsInvalid() {
        assertFalse(OrderValidator.isValidQuantity(0));
    }
    
    @Test
    @DisplayName("Should return false for negative quantity")
    void testNegativeQuantityIsInvalid() {
        assertFalse(OrderValidator.isValidQuantity(-1));
        assertFalse(OrderValidator.isValidQuantity(-100));
    }
    
    // ============ PRICE VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for positive price")
    void testPositivePriceIsValid() {
        assertTrue(OrderValidator.isValidPrice(0.01));
        assertTrue(OrderValidator.isValidPrice(150.50));
        assertTrue(OrderValidator.isValidPrice(2500.99));
    }
    
    @Test
    @DisplayName("Should return false for zero price")
    void testZeroPriceIsInvalid() {
        assertFalse(OrderValidator.isValidPrice(0.0));
    }
    
    @Test
    @DisplayName("Should return false for negative price")
    void testNegativePriceIsInvalid() {
        assertFalse(OrderValidator.isValidPrice(-10.0));
        assertFalse(OrderValidator.isValidPrice(-0.01));
    }
    
    // ============ TRANSACTION TYPE VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for valid transaction types")
    void testValidTransactionTypes() {
        assertTrue(OrderValidator.isValidTransactionType("BUY"));
        assertTrue(OrderValidator.isValidTransactionType("SELL"));
        assertTrue(OrderValidator.isValidTransactionType("buy"));  // Case insensitive
        assertTrue(OrderValidator.isValidTransactionType("sell"));
        assertTrue(OrderValidator.isValidTransactionType("Buy"));
        assertTrue(OrderValidator.isValidTransactionType("Sell"));
    }
    
    @Test
    @DisplayName("Should return false for null transaction type")
    void testNullTransactionTypeIsInvalid() {
        assertFalse(OrderValidator.isValidTransactionType(null));
    }
    
    @Test
    @DisplayName("Should return false for empty transaction type")
    void testEmptyTransactionTypeIsInvalid() {
        assertFalse(OrderValidator.isValidTransactionType(""));
        assertFalse(OrderValidator.isValidTransactionType("   "));
    }
    
    @Test
    @DisplayName("Should return false for invalid transaction type")
    void testInvalidTransactionTypeIsInvalid() {
        assertFalse(OrderValidator.isValidTransactionType("HOLD"));
        assertFalse(OrderValidator.isValidTransactionType("TRANSFER"));
        assertFalse(OrderValidator.isValidTransactionType("INVALID"));
    }
    
    // ============ ACCOUNT ID VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for positive account ID")
    void testPositiveAccountIdIsValid() {
        assertTrue(OrderValidator.isValidAccountId(1));
        assertTrue(OrderValidator.isValidAccountId(1001));
        assertTrue(OrderValidator.isValidAccountId(999999));
    }
    
    @Test
    @DisplayName("Should return false for zero account ID")
    void testZeroAccountIdIsInvalid() {
        assertFalse(OrderValidator.isValidAccountId(0));
    }
    
    @Test
    @DisplayName("Should return false for negative account ID")
    void testNegativeAccountIdIsInvalid() {
        assertFalse(OrderValidator.isValidAccountId(-1));
        assertFalse(OrderValidator.isValidAccountId(-1001));
    }
    
    // ============ COMPREHENSIVE VALIDATION TESTS ============
    
    @Test
    @DisplayName("Should return true for all valid order fields")
    void testAllValidFieldsReturnTrue() {
        boolean result = OrderValidator.isValidOrder(
            "AAPL",      // valid symbol
            100,         // valid quantity
            150.50,      // valid price
            "BUY",       // valid transaction type
            1001         // valid account ID
        );
        
        assertTrue(result);
    }
    
    @Test
    @DisplayName("Should return false if any field is invalid")
    void testInvalidFieldReturnsFalse() {
        // Invalid symbol
        assertFalse(OrderValidator.isValidOrder(
            "",          // invalid symbol
            100, 150.50, "BUY", 1001
        ));
        
        // Invalid quantity
        assertFalse(OrderValidator.isValidOrder(
            "AAPL", -100, 150.50, "BUY", 1001
        ));
        
        // Invalid price
        assertFalse(OrderValidator.isValidOrder(
            "AAPL", 100, 0, "BUY", 1001
        ));
        
        // Invalid transaction type
        assertFalse(OrderValidator.isValidOrder(
            "AAPL", 100, 150.50, "INVALID", 1001
        ));
        
        // Invalid account ID
        assertFalse(OrderValidator.isValidOrder(
            "AAPL", 100, 150.50, "BUY", 0
        ));
    }
    
    // ============ DETAILED VALIDATION RESULT TESTS ============
    
    @Test
    @DisplayName("Should return valid result for correct order")
    void testValidationResultForValidOrder() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", 100, 150.50, "BUY", 1001
        );
        
        assertTrue(result.isValid());
        assertEquals("✓ Order is valid", result.getReport());
    }
    
    @Test
    @DisplayName("Should report error for invalid symbol")
    void testValidationResultForInvalidSymbol() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "", 100, 150.50, "BUY", 1001
        );
        
        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("Symbol"));
    }
    
    @Test
    @DisplayName("Should report error for invalid quantity")
    void testValidationResultForInvalidQuantity() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", -100, 150.50, "BUY", 1001
        );
        
        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("Quantity"));
    }
    
    @Test
    @DisplayName("Should report error for invalid price")
    void testValidationResultForInvalidPrice() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", 100, -10, "BUY", 1001
        );
        
        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("Price"));
    }
    
    @Test
    @DisplayName("Should report error for invalid transaction type")
    void testValidationResultForInvalidTransactionType() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", 100, 150.50, "INVALID", 1001
        );
        
        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("TransactionType"));
    }
    
    @Test
    @DisplayName("Should report error for invalid account ID")
    void testValidationResultForInvalidAccountId() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", 100, 150.50, "BUY", -1001
        );
        
        assertFalse(result.isValid());
        assertTrue(result.getErrors().contains("AccountId"));
    }
    
    @Test
    @DisplayName("Should report multiple errors at once")
    void testValidationResultReportsMultipleErrors() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "",      // invalid symbol
            -100,    // invalid quantity
            0,       // invalid price
            "INVALID", // invalid transaction type
            -1001    // invalid account ID
        );
        
        assertFalse(result.isValid());
        String errors = result.getErrors();
        assertTrue(errors.contains("Symbol"));
        assertTrue(errors.contains("Quantity"));
        assertTrue(errors.contains("Price"));
        assertTrue(errors.contains("TransactionType"));
        assertTrue(errors.contains("AccountId"));
    }
    
    @Test
    @DisplayName("Should provide readable validation report")
    void testValidationReportFormatting() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", -100, 150.50, "BUY", 1001
        );
        
        String report = result.getReport();
        assertTrue(report.contains("✗"));
        assertTrue(report.contains("validation failed"));
        assertTrue(report.contains("Quantity"));
    }
    
    // ============ VALIDATION RESULT OBJECT TESTS ============
    
    @Test
    @DisplayName("ValidationResult toString should return report")
    void testValidationResultToString() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "AAPL", 100, 150.50, "BUY", 1001
        );
        
        assertEquals(result.getReport(), result.toString());
    }
    
    @Test
    @DisplayName("ValidationResult should handle valid order")
    void testValidationResultIsValidForCorrectData() {
        OrderValidator.ValidationResult result = OrderValidator.validateOrderWithDetails(
            "GOOGL", 50, 2800.75, "SELL", 1002
        );
        
        assertTrue(result.isValid());
        assertEquals("", result.getErrors());
    }
}
