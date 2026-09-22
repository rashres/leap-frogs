# Unit Testing Presentation - What I Accomplished

## 📊 Project Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEAP FROGS PROJECT                            │
│                   Unit Testing Initiative                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐         ┌──────────────────────────┐
│   insights-viz.py        │         │  test_insights_viz_      │
│   (Original File)        │────────▶│    simple.py             │
│                          │         │  (New Test File)         │
│ • Load Database          │         │                          │
│ • Query Data             │         │ ✓ 8 Unit Tests           │
│ • Create Visualizations  │         │ ✓ Real Data Processing   │
│ • Process DataFrames     │         │ ✓ No Database Needed     │
└──────────────────────────┘         └──────────────────────────┘
                                             │
                                             ▼
                                    ┌──────────────────────────┐
                                    │  sample_purchases.csv    │
                                    │  (Test Data)             │
                                    │                          │
                                    │ • 8 Stock Purchases      │
                                    │ • Real Price/Qty Data    │
                                    │ • $27,868.75 Total       │
                                    └──────────────────────────┘
```

---

## 🧪 The 8 Unit Tests I Created

```
TEST FILE: test_insights_viz_simple.py
├─ TEST 1: Load CSV ........................ ✓ File & Columns Exist
├─ TEST 2: Calculate Total Cost ........... ✓ Math Accuracy (qty × price)
├─ TEST 3: Filter High Volume Stocks ..... ✓ Data Filtering Works
├─ TEST 4: Sort by Trades Descending .... ✓ Sorting Works Correctly
├─ TEST 5: Sum Total Volume ............. ✓ Aggregation Works
├─ TEST 6: Group & Calculate Average .... ✓ Grouping Operations
├─ TEST 7: No Negative Values ........... ✓ Data Quality Checks
└─ TEST 8: Data Type Validation ......... ✓ Correct Data Types
```

---

## 📈 What Each Test Does

| Test # | What It Tests | Why It Matters | Example |
|--------|--------------|---------------|---------|
| 1 | Can we load a CSV file? | Verify data source exists | `sample_purchases.csv` loads successfully |
| 2 | Does math work? | Ensure calculations are accurate | 10 shares × $150 = $1,500 ✓ |
| 3 | Can we filter data? | Isolate important records | Find all stocks with volume > 2000 |
| 4 | Does sorting work? | Prepare data for charts | Order stocks: highest trades first |
| 5 | Can we sum totals? | Verify aggregations | Total volume = 10,600 |
| 6 | Can we group data? | Calculate averages per group | Avg trades per symbol |
| 7 | Is data clean? | Catch bad/negative values | All volumes must be positive |
| 8 | Are types correct? | Prevent calculation errors | Price = float, Quantity = int |

---

## 💾 Files Created

```
visualizations/
├── insights-viz.py ...................... Original visualization file
├── test_insights_viz_simple.py .......... NEW: Simple test file (8 tests)
├── sample_purchases.csv ................. NEW: Sample test data
├── TESTING_GUIDE.md ..................... NEW: Documentation
└── test_insights_viz.py ................. Original complex test (database)
```

---

## 🎯 Key Accomplishments

✅ **Created 8 Unit Tests** - Testing real DataFrame operations  
✅ **No Database Required** - Tests run independently  
✅ **Sample Data Created** - 8 stock purchases with realistic data  
✅ **Clear Documentation** - Each test has comments explaining purpose  
✅ **Data Quality Checks** - Validates calculations, types, and values  
✅ **Easy to Run** - Single command: `python -m unittest test_insights_viz_simple.py -v`

---

## 🚀 How to Run & Present

### Run the Tests:
```bash
python -m unittest test_insights_viz_simple.py -v
```

### Expected Output:
```
test_calculate_total_cost ... ok
test_data_types ... ok
test_filter_high_volume_stocks ... ok
test_group_and_average ... ok
test_load_csv_file ... ok
test_no_negative_values ... ok
test_sort_by_trades_descending ... ok
test_sum_total_volume ... ok

Ran 8 tests in 0.XXXs
OK
```

---

## 📊 Sample Test Data Summary

| Date | Symbol | Quantity | Price | Total Cost |
|------|--------|----------|-------|------------|
| 2024-01-01 | AAPL | 10 | $150.00 | $1,500.00 |
| 2024-01-02 | GOOGL | 20 | $140.50 | $2,810.00 |
| 2024-01-03 | MSFT | 15 | $300.00 | $4,500.00 |
| 2024-01-04 | TSLA | 25 | $180.75 | $4,518.75 |
| 2024-01-05 | AMZN | 12 | $165.50 | $1,986.00 |
| 2024-01-06 | AAPL | 30 | $152.25 | $4,567.50 |
| 2024-01-07 | META | 18 | $210.00 | $3,780.00 |
| 2024-01-08 | NFLX | 22 | $195.75 | $4,306.50 |
| | **TOTALS** | **152 shares** | | **$27,868.75** |

---

## 💡 What I Learned About Unit Testing

1. **Mocking vs Real Data** - Started with database mocks, switched to actual DataFrames
2. **Test Independence** - Each test runs independently without side effects
3. **Clear Test Names** - Test names explain WHAT they test
4. **Arrange-Act-Assert** - Setup data → Run code → Verify results
5. **Data Quality Matters** - Tests catch bad data before it breaks visualizations

---

## 🎓 Technical Skills Demonstrated

- ✓ Writing unit tests in Python
- ✓ Using unittest framework
- ✓ Working with pandas DataFrames
- ✓ Testing calculations and data transformations
- ✓ Data validation and quality checks
- ✓ Creating test data (sample CSV)
- ✓ Testing without external dependencies

