import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import os
import sys

# Import the module to test
import insights_viz


class TestInsightsViz(unittest.TestCase):
    """Unit tests for insights-viz.py"""

    @patch.object(sys.modules['insights_viz'].psycopg2, 'connect')
    def test_connect_to_db_success(self, mock_connect):
        """Test successful database connection"""
        # Mock a successful connection
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        result = insights_viz.connect_to_db()
        
        self.assertIsNotNone(result)
        mock_connect.assert_called_once()

    @patch.object(sys.modules['insights_viz'].psycopg2, 'connect')
    def test_connect_to_db_failure(self, mock_connect):
        """Test database connection failure"""
        # Mock a connection error
        mock_connect.side_effect = sys.modules['insights_viz'].psycopg2.Error("Connection refused")
        
        result = insights_viz.connect_to_db()
        
        self.assertIsNone(result)

    @patch.object(sys.modules['insights_viz'].pd, 'read_sql')
    def test_query_data_success(self, mock_read_sql):
        """Test successful query execution"""
        # Create mock data
        mock_df = pd.DataFrame({
            'symbol': ['AAPL', 'GOOGL', 'MSFT'],
            'total_volume': [1000, 2000, 1500]
        })
        mock_read_sql.return_value = mock_df
        mock_conn = MagicMock()
        
        result = insights_viz.query_data(mock_conn, "SELECT * FROM trading_volume;")
        
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 3)
        self.assertIn('symbol', result.columns)

    @patch.object(sys.modules['insights_viz'].pd, 'read_sql')
    def test_query_data_failure(self, mock_read_sql):
        """Test query execution failure"""
        # Mock a query error
        mock_read_sql.side_effect = sys.modules['insights_viz'].psycopg2.Error("Query error")
        mock_conn = MagicMock()
        
        result = insights_viz.query_data(mock_conn, "SELECT * FROM trading_volume;")
        
        self.assertIsNone(result)

    def test_sample_data_structure(self):
        """Test that sample data has expected columns"""
        # Read sample data
        sample_file = os.path.join(os.path.dirname(__file__), 'sample_purchases.csv')
        if os.path.exists(sample_file):
            df = pd.read_csv(sample_file)
            
            # Check expected columns exist
            expected_cols = ['date', 'symbol', 'quantity', 'price']
            for col in expected_cols:
                self.assertIn(col, df.columns)
            
            # Check data types
            self.assertEqual(df['quantity'].dtype, int)
            self.assertEqual(df['price'].dtype, float)

    def test_purchase_calculation(self):
        """Test calculating total purchases"""
        # Create sample data
        data = {
            'date': ['2024-01-01', '2024-01-02', '2024-01-03'],
            'symbol': ['AAPL', 'GOOGL', 'MSFT'],
            'quantity': [10, 20, 15],
            'price': [150.00, 140.50, 300.00]
        }
        df = pd.DataFrame(data)
        
        # Calculate total cost per purchase
        df['total_cost'] = df['quantity'] * df['price']
        
        # Test the calculations
        self.assertEqual(df['total_cost'].iloc[0], 1500.0)  # 10 * 150
        self.assertEqual(df['total_cost'].iloc[1], 2810.0)  # 20 * 140.50
        self.assertEqual(df['total_cost'].iloc[2], 4500.0)  # 15 * 300


if __name__ == '__main__':
    unittest.main()
