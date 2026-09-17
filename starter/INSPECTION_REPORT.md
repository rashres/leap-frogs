# 📋 Java Project Inspection Report - Order Validation Feature
## feature/TradeServices Branch Analysis

---

## 1️⃣ PROJECT STRUCTURE

### Main Directory Layout
```
leap-frogs/
├── src/                          # Root Java project
│   └── main/java/com/neueda/leap/
│       └── Main.java             (Older, minimal)
│
├── starter/                       # **ACTIVE PROJECT** (Java 21)
│   ├── pom.xml                   (Maven config)
│   ├── src/main/java/
│   │   └── com/neueda/leap/
│   │       └── Main.java         (Entry point)
│   └── src/test/java/
│       └── com/neueda/leap/
│           └── PlaceholderTest.java
│
└── database/
    └── capstone-analytics-schema.sql  (Domain model)
```

### Which Project to Use? ✅
**→ Use the `starter/` folder** (not `src/`)
- Java 21 (compiler target)
- JUnit 5 configured
- Modern Maven setup
- Proper test structure

---

## 2️⃣ EXISTING NAMING CONVENTIONS

### Package Structure
- **Package**: `com.neueda.leap`
- **Hierarchy**: `com` → `neueda` → `leap` → [classes]
- **Consistency**: Simple, flat package (no sub-packages yet)

### Class Naming
- **Main.java** - Entry point (follows Java convention)
- **PascalCase** for class names
- **No prefixes/suffixes** (Test uses "Test" suffix for tests only)

### Method Naming
- **camelCase** for methods
- Example: `main()`, `placeholderTestPassesUntilRealTestsExist()`

### Field Naming
- No fields visible in current code
- Expected: **private** fields with **camelCase**
- Getters/Setters: `get<Property>()`, `set<Property>()`

### Constructor Naming
- Not yet defined in codebase
- Expected: **public** and named **same as class name**
- Example: `public Order(String symbol, int quantity) { ... }`

### Test Naming
- Class suffix: `Test` (e.g., `OrderValidationTest.java`)
- Method prefix: `test` (e.g., `testValidateOrderQuantity()`)
- Framework: **JUnit 5** (`org.junit.jupiter`)

---

## 3️⃣ DOMAIN MODEL (From Database Schema)

### Trade/Order Related Tables
```sql
fact_trades (
    transaction_id INT PRIMARY KEY,
    account_id INT,
    symbol VARCHAR(20),
    transaction_type VARCHAR(4) CHECK IN ('BUY', 'SELL'),  ← Validation needed!
    quantity NUMERIC(18,6),
    price NUMERIC(18,6),
    amount NUMERIC(18,2),
    trade_date DATE,
    transactions_time TIMESTAMPTZ
);
```

### Validation Rules Implied
- ✅ **transaction_type** must be 'BUY' or 'SELL'
- ✅ **quantity** must be positive numeric
- ✅ **price** must be positive numeric
- ✅ **symbol** must be non-empty
- ✅ **account_id** must be valid
- ✅ **amount** = quantity × price (calculated)

---

## 4️⃣ RECENT COMMIT HISTORY (feature/TradeServices)

```
1ca8f22 (HEAD -> feature/TradeServices) - new branch
22a038a - password encoding fix
3f3ea34 - etl fix
27d3a60 - add note
14edc10 - refactor: docker-compose
```

**→ Note**: Recent commits focus on **ETL and database**, NOT Java yet.
This suggests you're the **first to implement Java logic** for this feature! 🎉

---

## 5️⃣ EXISTING CODE PATTERNS

### Testing Pattern (from PlaceholderTest.java)
```java
package com.neueda.leap;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class PlaceholderTest {
    @Test
    void placeholderTestPassesUntilRealTestsExist() {
        assertTrue(true);
    }
}
```

**Key Patterns**:
- ✅ Use `org.junit.jupiter.api.*` (JUnit 5)
- ✅ Method names are descriptive: `testSomethingSpecific()`
- ✅ Static imports for assertions
- ✅ `@Test` annotation on each test

### Entry Point Pattern (Main.java)
```java
package com.neueda.leap;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("Hello world from the team's Sprint 1 project skeleton");
        // ...
    }
}
```

**Key Patterns**:
- ✅ Simple, clean structure
- ✅ Proper package declaration
- ✅ Static main method

---

## 6️⃣ BUILD CONFIGURATION (pom.xml)

```xml
<properties>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
</properties>

<dependencies>
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.10.2</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

**Key Points**:
- ✅ **Java 21** (modern language features available)
- ✅ **JUnit 5.10.2** (latest test framework)
- ✅ Maven Surefire plugin configured for tests

---

## 7️⃣ SIMILAR VALIDATION LOGIC - DOES IT EXIST?

### Search Results: ❌ NO
- No existing `Order` class
- No existing `OrderValidator` class
- No existing validation logic
- No existing transaction/trade classes

**→ You have a clean slate!** This is your opportunity to establish good patterns.

---

## 📊 RECOMMENDATION: Order Validation Class Structure

Based on the analysis, here's what should be created:

### ✅ File Location
```
starter/src/main/java/com/neueda/leap/Order.java
```

### ✅ Basic Template
```java
package com.neueda.leap;

public class Order {
    // Fields (private)
    private String symbol;
    private int quantity;
    private double price;
    private String transactionType;  // "BUY" or "SELL"
    
    // Constructor(s)
    public Order(String symbol, int quantity, double price, String transactionType) {
        // Initialize fields
    }
    
    // Validation methods
    public boolean isValid() {
        // Check all business rules
    }
    
    // Getters and Setters
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
    
    // toString, equals, hashCode
}
```

### ✅ Test File Location
```
starter/src/test/java/com/neueda/leap/OrderTest.java
```

### ✅ Test Pattern
```java
package com.neueda.leap;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class OrderTest {
    
    @Test
    void testValidOrderCreation() {
        Order order = new Order("AAPL", 100, 150.00, "BUY");
        assertTrue(order.isValid());
    }
    
    @Test
    void testInvalidTransactionType() {
        Order order = new Order("AAPL", 100, 150.00, "INVALID");
        assertFalse(order.isValid());
    }
}
```

---

## 🎯 NEXT STEPS

1. ✅ **Create Order.java** in `starter/src/main/java/com/neueda/leap/`
2. ✅ **Implement constructor** with parameter validation
3. ✅ **Add validation logic** (transaction type, quantity, price, symbol)
4. ✅ **Create OrderTest.java** following JUnit 5 patterns
5. ✅ **Run tests** with Maven: `mvn test`

---

## 🔍 CONFIRMATION CHECKLIST

- [x] Project uses **Java 21** (starter folder)
- [x] Package name is **`com.neueda.leap`**
- [x] Naming convention: **PascalCase** classes, **camelCase** methods/fields
- [x] Test framework: **JUnit 5** (Jupiter)
- [x] No existing Order/Validation classes found
- [x] Database schema confirms validation requirements
- [x] Team recently focused on ETL, Java layer is **new responsibility**
- [x] Ready to implement! 🚀
