import unittest
import pandas as pd
import os


class TestDataFrameOperations(unittest.TestCase):
    """
    Simple unit tests for DataFrame operations and calculations.
    No database mocking - just pure data processing.
    """

    def setUp(self):
        """Create sample data before each test runs"""
        self.df_trading = pd.DataFrame({
            'symbol': ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'],
            'total_volume': [1000, 2500, 1800, 3200, 2100]
        })

        self.df_activity = pd.DataFrame({
            'symbol': ['AAPL', 'GOOGL', 'MSFT', 'NFLX', 'META'],
            'trades': [150, 200, 175, 220, 190]
        })

    # ==================== TEST 1: DATA LOADING ====================
    def test_load_csv_file(self):
        """
        TEST: Can we load a CSV file?
        WHY: Confirms file exists and has correct structure
        """
        sample_file = 'sample_purchases.csv'
        self.assertTrue(os.path.exists(sample_file), "Sample CSV file not found")
        
        df = pd.read_csv(sample_file)
        self.assertEqual(len(df), 8, "Should have 8 rows")
        self.assertIn('symbol', df.columns, "Should have 'symbol' column")
        self.assertIn('quantity', df.columns, "Should have 'quantity' column")

    # ==================== TEST 2: CALCULATIONS ====================
    def test_calculate_total_cost(self):
        """
        TEST: Calculate total cost (quantity × price)
        WHY: Verify math is correct
        
        Example: 10 shares × $150 = $1,500
        """
        df = pd.DataFrame({
            'quantity': [10, 20, 5],
            'price': [150.0, 100.0, 200.0]
        })
        
        df['total_cost'] = df['quantity'] * df['price']
        
        self.assertEqual(df['total_cost'].iloc[0], 1500.0)
        self.assertEqual(df['total_cost'].iloc[1], 2000.0)
        self.assertEqual(df['total_cost'].iloc[2], 1000.0)

    # ==================== TEST 3: FILTERING ====================

    def test_filter_high_volume_stocks(self):
        """
        TEST: Filter stocks with volume > 2000
        WHY: Verify we can isolate important data
        
        Expected: GOOGL (2500), TSLA (3200), AMZN (2100)
        """
        high_volume = self.df_trading[self.df_trading['total_volume'] > 2000]
        
        self.assertEqual(len(high_volume), 3, "Should find 3 high-volume stocks")
        self.assertIn('GOOGL', high_volume['symbol'].values)
        self.assertIn('TSLA', high_volume['symbol'].values)

    # ==================== TEST 4: SORTING ====================
    def test_sort_by_trades_descending(self):
        """
        TEST: Sort stocks by number of trades (highest first)
        WHY: Verify data ordering for visualizations
        
        Expected order: NFLX (220), GOOGL (200), META (190), MSFT (175), AAPL (150)
        """
        sorted_df = self.df_activity.sort_values('trades', ascending=False)
        
        first_symbol = sorted_df.iloc[0]['symbol']
        self.assertEqual(first_symbol, 'NFLX', "NFLX should be first (highest trades)")
        self.assertEqual(sorted_df.iloc[0]['trades'], 220)

    # ==================== TEST 5: AGGREGATION ====================
    def test_sum_total_volume(self):
        """
        TEST: Sum all trading volumes
        WHY: Verify aggregation works correctly
        
        Expected: 1000 + 2500 + 1800 + 3200 + 2100 = 10,600
        """
        total = self.df_trading['total_volume'].sum()
        
        self.assertEqual(total, 10600)

    # ==================== TEST 6: GROUPING ====================
    def test_group_and_average(self):
        """
        TEST: Group data and calculate average
        WHY: Verify grouping operations work
        
        Example: Average trades per symbol
        """
        df_grouped = pd.DataFrame({
            'symbol': ['AAPL', 'AAPL', 'GOOGL', 'GOOGL'],
            'trades': [50, 60, 100, 110]
        })
        
        avg_by_symbol = df_grouped.groupby('symbol')['trades'].mean()
        
        self.assertEqual(avg_by_symbol['AAPL'], 55.0)
        self.assertEqual(avg_by_symbol['GOOGL'], 105.0)

    # ==================== TEST 7: DATA VALIDATION ====================
    def test_no_negative_values(self):
        """
        TEST: Ensure no negative volumes or trades
        WHY: Data quality check - catches bad data
        """
        self.assertTrue((self.df_trading['total_volume'] > 0).all())
        self.assertTrue((self.df_activity['trades'] > 0).all())

    # ==================== TEST 8: COLUMN TYPES ====================
    def test_data_types(self):
        """
        TEST: Verify columns have correct data types
        WHY: Prevents calculation errors (string vs number)
        """
        df = pd.read_csv('sample_purchases.csv')
        
        self.assertEqual(df['quantity'].dtype, int, "Quantity should be integer")
        self.assertEqual(df['price'].dtype, float, "Price should be float")
        self.assertEqual(df['symbol'].dtype, object, "Symbol should be string")


if __name__ == '__main__':
    unittest.main()
