# Unit Testing Guide for insights-viz.py

## Sample Purchase Data

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

**Total Purchases: 152 shares | Total Investment: $27,868.75**

---

## Running the Tests

```bash
# Run all tests
python -m unittest test_insights_viz.py

# Run a specific test
python -m unittest test_insights_viz.TestInsightsViz.test_connect_to_db_success

# Run with verbose output
python -m unittest test_insights_viz.py -v
```

## What Each Test Does

| Test | Purpose |
|------|---------|
| `test_connect_to_db_success` | Verifies database connection works |
| `test_connect_to_db_failure` | Verifies error handling when connection fails |
| `test_query_data_success` | Verifies SQL queries return data correctly |
| `test_query_data_failure` | Verifies error handling when query fails |
| `test_sample_data_structure` | Verifies sample CSV has correct columns |
| `test_purchase_calculation` | Verifies math calculations are correct |

---

## Key Concepts for Your First Unit Tests

1. **Mocking**: We use `@patch` to fake database connections so we don't need a real database
2. **Assertions**: We use `self.assert*()` to check if results are what we expect
3. **Test Data**: `sample_purchases.csv` gives us realistic data to work with
