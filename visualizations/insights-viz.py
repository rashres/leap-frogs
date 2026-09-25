import os
import psycopg2
from psycopg2 import sql
import pandas as pd
import matplotlib.pyplot as plt
from dotenv import load_dotenv

load_dotenv('/home/ec2-user/leap-frogs/.env')


# Database connection details
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '8100')
DB_NAME = os.getenv('POSTGRES_DB', 'leap_analytics')
DB_USER = os.getenv('POSTGRES_USER')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD')

def connect_to_db():
    """Establish connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        print(f"✓ Connected to {DB_NAME} on {DB_HOST}:{DB_PORT}")
        return conn
    except psycopg2.Error as e:
        print(f"✗ Error connecting to database: {e}")
        return None

def query_data(conn, query):
    """Execute a query and return results as a DataFrame."""
    try:
        df = pd.read_sql(query, conn)
        return df
    except psycopg2.Error as e:
        print(f"✗ Error executing query: {e}")
        return None

if __name__ == "__main__":
    conn = connect_to_db()
    
    # Query trading volume by symbol from the database
    query_trading_volume = """
    SELECT symbol, stock_name, total_volume
    FROM trading_volume
    ORDER BY total_volume DESC
    """
    df = query_data(conn, query_trading_volume)
    
    if df is not None:
        print(f"\n{df.shape[0]} symbols retrieved")
        print(df.head())
        
        # Visualize trading volume by stock symbol
        plt.figure(figsize=(12, 6))
        plt.bar(df['symbol'], df['total_volume'])
        plt.xlabel('Symbol')
        plt.ylabel('Total Volume')
        plt.title('Trading Volume by Symbol')
        plt.show()
    
    # Query most active instruments from the database
    query_most_active = """
    SELECT symbol, stock_name, trades
    FROM instrument_activity
    ORDER BY trades DESC
    LIMIT 10
    """
    df_most_active = query_data(conn, query_most_active)
    
    if df_most_active is not None:
        plt.figure(figsize=(12, 6))
        plt.bar(df_most_active['symbol'], df_most_active['trades'])
        plt.xlabel('Symbol')
        plt.ylabel('Trades')
        plt.title('Most Active Instruments by Trading Volume')
        plt.show()
    
    # Query client activity trends from the database
    query_client_activity = """
    SELECT month, segment, avg_trades_per_client
    FROM client_activity
    ORDER BY month, segment
    """
    df_client_activity = query_data(conn, query_client_activity)
    
    if df_client_activity is not None:
        plt.figure(figsize=(12, 6))
        for segment, group in df_client_activity.groupby('segment'):
            plt.plot(group['month'], group['avg_trades_per_client'], label=f'Segment {segment}', marker='o')
        plt.xlabel('Date')
        plt.ylabel('Avg Trades Per Client')
        plt.title('Client Activity Trends')
        plt.legend()
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()
