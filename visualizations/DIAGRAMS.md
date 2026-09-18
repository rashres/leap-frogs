# Unit Testing Workflow Diagram

## System Architecture

```mermaid
graph TB
    A["📂 insights-viz.py<br/>(Original Code)"]
    B["🧪 test_insights_viz_simple.py<br/>(8 Unit Tests)"]
    C["📊 sample_purchases.csv<br/>(Test Data)"]
    D["✅ Test Results<br/>(Pass/Fail)"]
    
    A -->|Contains functions to test| B
    C -->|Provides sample data| B
    B -->|Executes tests| D
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
```

---

## Test Execution Flow

```mermaid
sequenceDiagram
    User->>Terminal: python -m unittest<br/>test_insights_viz_simple.py -v
    Terminal->>TestFile: Load test file
    TestFile->>setUp: Create test data
    setUp-->>TestFile: DataFrames ready
    
    TestFile->>Test1: test_load_csv_file
    Test1->>Test1: Check file exists
    Test1-->>Result1: ✓ PASS
    
    TestFile->>Test2: test_calculate_total_cost
    Test2->>Test2: 10 × $150 = $1500?
    Test2-->>Result2: ✓ PASS
    
    TestFile->>Test8: test_data_types
    Test8->>Test8: Verify types
    Test8-->>Result8: ✓ PASS
    
    Result1-->>Terminal: All 8 tests passed!
    Terminal-->>User: OK - 0.XXXs
```

---

## Data Processing Pipeline

```mermaid
graph LR
    A["CSV File"] -->|Load| B["DataFrame"]
    B -->|Filter| C["High Volume Stocks"]
    B -->|Sort| D["Ranked by Trades"]
    B -->|Group| E["Average per Symbol"]
    B -->|Aggregate| F["Total Volume"]
    B -->|Validate| G["Data Quality Check"]
    
    C & D & E & F & G -->|Tested By| H["Unit Tests"]
    H --> I["✓ PASS"]
    
    style A fill:#e3f2fd
    style B fill:#e8eaf6
    style I fill:#c8e6c9
```

---

## Test Coverage Breakdown

```mermaid
pie title "8 Unit Tests Coverage"
    "Data Loading (1 test)" : 12.5
    "Calculations (1 test)" : 12.5
    "Filtering (1 test)" : 12.5
    "Sorting (1 test)" : 12.5
    "Aggregation (1 test)" : 12.5
    "Grouping (1 test)" : 12.5
    "Data Validation (1 test)" : 12.5
    "Type Checking (1 test)" : 12.5
```

---

## Skills & Concepts Covered

```mermaid
mindmap
  root((Unit Testing))
    Testing Basics
      What is a unit test?
      Why test?
      Test structure
    Python Testing
      unittest framework
      setUp method
      Assertions
    Data Testing
      DataFrame validation
      Calculations
      Data types
    Quality Assurance
      Data quality checks
      Edge cases
      Error handling
    Best Practices
      Clear test names
      Documentation
      Independent tests
```

---

## Before vs After Comparison

```mermaid
graph TB
    subgraph Before["❌ BEFORE (No Tests)"]
        A1["Code in insights-viz.py"]
        A2["Database dependency"]
        A3["Manual testing only"]
        A4["No data validation"]
    end
    
    subgraph After["✅ AFTER (With Tests)"]
        B1["test_insights_viz_simple.py"]
        B2["No database needed"]
        B3["Automated testing"]
        B4["8 quality checks"]
    end
    
    Before -->|Created Unit Tests| After
    
    style Before fill:#ffebee
    style After fill:#e8f5e9
```

