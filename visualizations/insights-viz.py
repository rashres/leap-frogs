import os
import psycopg2
from psycopg2 import sql
import pandas as pd
import matplotlib.pyplot as plt
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database connection details
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('POSTGRES_DB', 'leapfrogsdb')
DB_USER = os.getenv('POSTGRES_USER', 'postgres')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')

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
    
    query = "SELECT symbol, total_volume FROM trading_volume;"
    
    plt.bar(df['symbol'], df['total_volume'])
    plt.xlabel('Symbol')
    plt.ylabel('Total Volume')
    plt.title('Trading Volume by Symbol')
    plt.show()
    
    
    try:
        df = pd.read_sql(query, conn)
        return df
    except psycopg2.Error as e:
        print(f"✗ Error executing query: {e}")
        return None

if __name__ == "__main__":
    conn = connect_to_db()
    if conn:
        # Example: query trading volume data
        query = "SELECT * FROM trading_volume;"
        df = query_data(conn, query)
        if df is not None:
            print(f"\n{df.shape[0]} rows retrieved")
            print(df.head())
        conn.close()
