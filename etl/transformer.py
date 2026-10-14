"""
ETL Transformer Module

Transforms extracted data using pandas for analytics database.
"""

import logging
from datetime import datetime
from typing import Tuple

import pandas as pd

logger = logging.getLogger(__name__)


class ETLTransformer:
    """Transform extracted data for analytics database"""
    
    @staticmethod
    def build_fact_trades(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame,
        account_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build denormalized fact_trades table by joining all dimensions.
        
        Transformations:
        - Calculate amount = quantity × price
        - Extract trade_date from transaction_time
        - Derive segment (hardcoded for MVP)
        - Add refreshed_at timestamp
        """
        logger.info("  Transforming: fact_trades (denormalized)")
        
        # Rename dimension columns before join so pandas suffixes do not hide them.
        # stock.name and exchange.name only become name_stock / name_exchange when
        # both sides already have a `name` column; transactions does not, so the
        # stock name would otherwise stay as `name` and this select would KeyError.
        stock = stock_df.rename(columns={'name': 'stock_name'})
        exchange = exchange_df.rename(columns={'name': 'exchange_name'})

        df = transactions_df.merge(stock, on='instrument_id', how='left')
        df = df.merge(exchange, on='exchange_id', how='left')
        df = df.rename(columns={'transaction_time': 'transactions_time'})
        
        # Calculate derived fields
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        df['trade_date'] = pd.to_datetime(df['transactions_time']).dt.date
        df['segment'] = 'Standard'  # Hardcoded for MVP; could derive from account
        df['refreshed_at'] = datetime.now()
        
        # Select only required columns
        fact_trades = df[[
            'transaction_id', 'account_id', 'symbol', 'segment',
            'stock_name', 'exchange_name', 'transaction_type',
            'quantity', 'price', 'amount', 'trade_date',
            'transactions_time', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(fact_trades)} fact_trades rows")
        return fact_trades
    
    @staticmethod
    def build_trading_volume(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated trading_volume table.
        
        Aggregations:
        - GROUP BY symbol
        - SUM quantity BY transaction_type (BUY vs SELL)
        - Calculate notional = SUM(quantity × price)
        """
        logger.info("  Transforming: trading_volume (aggregated)")
        
        # Join transactions with stock
        df = transactions_df.merge(stock_df, on='instrument_id', how='left')
        
        # Calculate amount for notional
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        
        # Group by symbol and transaction type
        grouped = df.groupby(['symbol', 'transaction_type']).agg({
            'quantity': 'sum',
            'amount': 'sum'
        }).reset_index()
        
        # Pivot to get BUY and SELL columns (either side may be missing)
        pivot = grouped.pivot(
            index='symbol',
            columns='transaction_type',
            values='quantity'
        ).fillna(0)
        pivot.columns.name = None
        for col in ('BUY', 'SELL'):
            if col not in pivot.columns:
                pivot[col] = 0

        trading_volume = pivot.reset_index().rename(columns={
            'BUY': 'buy_volume',
            'SELL': 'sell_volume'
        })
        
        trading_volume['total_volume'] = \
            trading_volume['buy_volume'] + trading_volume['sell_volume']
        
        # Calculate notional (for each symbol)
        notional_calc = df.groupby('symbol')['amount'].sum().reset_index()
        notional_calc.columns = ['symbol', 'notional']
        
        trading_volume = trading_volume.merge(
            notional_calc,
            on='symbol',
            how='left'
        )
        
        # Add stock name from instrument table
        trading_volume = trading_volume.merge(
            stock_df[['symbol', 'name']].drop_duplicates(),
            on='symbol',
            how='left'
        )
        trading_volume = trading_volume.rename(columns={'name': 'stock_name'})
        
        # Add timestamp
        trading_volume['refreshed_at'] = datetime.now()
        
        # Select and reorder columns
        trading_volume = trading_volume[[
            'symbol', 'stock_name', 'buy_volume', 'sell_volume',
            'total_volume', 'notional', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(trading_volume)} trading_volume rows")
        return trading_volume
    
    @staticmethod
    def build_instrument_activity(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated instrument_activity table.
        
        Aggregations:
        - GROUP BY symbol
        - COUNT total trades
        - COUNT DISTINCT clients
        - COUNT BUY vs SELL trades
        """
        logger.info("  Transforming: instrument_activity (aggregated)")
        
        # Join transactions with stock
        df = transactions_df.merge(stock_df, on='instrument_id', how='left')
        
        # Group by symbol and calculate metrics
        activity = df.groupby('symbol').agg({
            'transaction_id': 'count',           # Total trades
            'account_id': 'nunique',              # Unique clients
        }).reset_index()
        
        activity.columns = ['symbol', 'trades', 'clients']
        
        # Count BUY and SELL trades
        buy_sell_counts = df.groupby(['symbol', 'transaction_type']).size().unstack(
            fill_value=0
        ).reset_index()
        
        activity = activity.merge(
            buy_sell_counts,
            on='symbol',
            how='left'
        )

        for col in ('BUY', 'SELL'):
            if col not in activity.columns:
                activity[col] = 0
        activity['buy_trades'] = activity['BUY'].fillna(0).astype(int)
        activity['sell_trades'] = activity['SELL'].fillna(0).astype(int)
        
        # Add stock name
        activity = activity.merge(
            stock_df[['symbol', 'name']].drop_duplicates(),
            on='symbol',
            how='left'
        )
        activity = activity.rename(columns={'name': 'stock_name'})
        
        # Add timestamp
        activity['refreshed_at'] = datetime.now()
        
        # Select and reorder columns
        instrument_activity = activity[[
            'symbol', 'stock_name', 'trades', 'clients',
            'buy_trades', 'sell_trades', 'refreshed_at'
        ]].copy()
        
        logger.info(f"    ✓ Created {len(instrument_activity)} instrument_activity rows")
        return instrument_activity
    
    @staticmethod
    def build_client_activity(
        transactions_df: pd.DataFrame,
        account_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build aggregated client_activity table by month and segment.
        
        Aggregations:
        - GROUP BY YEAR_MONTH, segment
        - COUNT DISTINCT clients per month
        - COUNT and SUM trades/volume per month
        - Calculate average trades per client
        """
        logger.info("  Transforming: client_activity (aggregated)")
        
        # Join with account
        df = transactions_df.merge(account_df, on='account_id', how='left')
        
        # Extract year-month
        df['transaction_time'] = pd.to_datetime(df['transaction_time'])
        df['month'] = df['transaction_time'].dt.to_period('M').dt.to_timestamp()
        
        # Add segment (hardcoded for MVP)
        df['segment'] = 'Standard'
        
        # Calculate amount for volume
        df['amount'] = df['quantity'].astype(float) * df['price'].astype(float)
        
        # Group by month and segment
        client_activity = df.groupby(['month', 'segment']).agg({
            'account_id': 'nunique',           # Active clients
            'transaction_id': 'count',         # Number of trades
            'quantity': 'sum'                  # Total volume
        }).reset_index()
        
        client_activity.columns = ['month', 'segment', 'active_clients', 'trades', 'volume']
        
        # Calculate average trades per client
        client_activity['avg_trades_per_client'] = (
            client_activity['trades'] / client_activity['active_clients']
        ).round(2)
        
        # Add timestamp
        client_activity['refreshed_at'] = datetime.now()
        
        # Ensure month is DATE type
        client_activity['month'] = client_activity['month'].dt.date
        
        logger.info(f"    ✓ Created {len(client_activity)} client_activity rows")
        return client_activity
    
    FACT_ORDERS_COLUMNS = [
        'transaction_id', 'account_id', 'symbol', 'stock_name', 'exchange_name',
        'transaction_type', 'order_type', 'time_in_force', 'status',
        'quantity', 'limit_price', 'price', 'amount',
        'placed_at', 'filled_at', 'closed_at', 'expires_at', 'placed_date', 'refreshed_at'
    ]

    ORDER_OUTCOMES_COLUMNS = [
        'symbol', 'stock_name', 'orders', 'filled', 'pending',
        'cancelled', 'expired', 'rejected', 'cancel_rate', 'refreshed_at'
    ]

    # Operational status -> order_outcomes column.
    OUTCOME_OF_STATUS = {
        'COMPLETE': 'filled',
        'PENDING': 'pending',
        'CANCELLED': 'cancelled',
        'EXPIRED': 'expired',
        'FAILED': 'rejected',
    }

    @staticmethod
    def build_fact_orders(
        orders_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build fact_orders: one row per order in every status, with its timeline.

        This is where cancellations and expiries are recorded for analytics;
        fact_trades only ever holds filled orders.
        """
        logger.info("  Transforming: fact_orders (every order, every status)")

        stock = stock_df.rename(columns={'name': 'stock_name'})
        exchange = exchange_df.rename(columns={'name': 'exchange_name'})

        df = orders_df.merge(stock[['instrument_id', 'symbol', 'stock_name', 'exchange_id']], on='instrument_id', how='left')
        df = df.merge(exchange[['exchange_id', 'exchange_name']], on='exchange_id', how='left')

        df['amount'] = (df['quantity'].astype(float) * df['price'].astype(float)).round(2)
        df['placed_date'] = pd.to_datetime(df['placed_at'], utc=True).dt.date
        df['refreshed_at'] = datetime.now()

        fact_orders = df[ETLTransformer.FACT_ORDERS_COLUMNS].copy()
        counts = fact_orders['status'].value_counts().to_dict()
        logger.info(f"    ✓ Created {len(fact_orders)} fact_orders rows {counts}")
        return fact_orders

    @staticmethod
    def build_order_outcomes(
        orders_df: pd.DataFrame,
        stock_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Build order_outcomes: per instrument, how many orders filled, are still
        pending, were cancelled, expired or were rejected, plus the cancel rate.
        """
        logger.info("  Transforming: order_outcomes (aggregated)")

        df = orders_df.merge(stock_df[['instrument_id', 'symbol', 'name']], on='instrument_id', how='left')
        df['outcome'] = df['status'].map(ETLTransformer.OUTCOME_OF_STATUS)

        outcomes = df.groupby(['symbol', 'outcome']).size().unstack(fill_value=0)
        for col in ETLTransformer.OUTCOME_OF_STATUS.values():
            if col not in outcomes.columns:
                outcomes[col] = 0
        outcomes = outcomes.reset_index()
        outcomes.columns.name = None

        outcomes['orders'] = df.groupby('symbol').size().reindex(outcomes['symbol']).to_numpy()
        outcomes['cancel_rate'] = (outcomes['cancelled'] / outcomes['orders'] * 100).round(2)

        outcomes = outcomes.merge(
            stock_df[['symbol', 'name']].drop_duplicates(),
            on='symbol',
            how='left'
        ).rename(columns={'name': 'stock_name'})
        outcomes['refreshed_at'] = datetime.now()

        order_outcomes = outcomes[ETLTransformer.ORDER_OUTCOMES_COLUMNS].copy()
        logger.info(f"    ✓ Created {len(order_outcomes)} order_outcomes rows")
        return order_outcomes

    @staticmethod
    def transform_orders(
        orders_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """fact_orders and order_outcomes, or empty tables when there are no orders."""
        if orders_df.empty:
            logger.warning("No orders found; writing empty order-outcome tables")
            return (
                pd.DataFrame(columns=ETLTransformer.FACT_ORDERS_COLUMNS),
                pd.DataFrame(columns=ETLTransformer.ORDER_OUTCOMES_COLUMNS),
            )
        return (
            ETLTransformer.build_fact_orders(orders_df, stock_df, exchange_df),
            ETLTransformer.build_order_outcomes(orders_df, stock_df),
        )

    @staticmethod
    def transform_all(
        transactions_df: pd.DataFrame,
        stock_df: pd.DataFrame,
        exchange_df: pd.DataFrame,
        account_df: pd.DataFrame,
        orders_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Execute all transformations"""
        logger.info("=" * 70)
        logger.info("PHASE 2: TRANSFORM")
        logger.info("=" * 70)

        try:
            # Built even with no filled trades: an account that has only
            # cancelled or pending orders still has outcomes to report.
            fact_orders, order_outcomes = ETLTransformer.transform_orders(orders_df, stock_df, exchange_df)

            if transactions_df.empty:
                logger.warning("No transactions found; writing empty analytics tables")
                return (
                    pd.DataFrame(columns=[
                        'transaction_id', 'account_id', 'symbol', 'segment',
                        'stock_name', 'exchange_name', 'transaction_type',
                        'quantity', 'price', 'amount', 'trade_date',
                        'transactions_time', 'refreshed_at'
                    ]),
                    pd.DataFrame(columns=[
                        'symbol', 'stock_name', 'buy_volume', 'sell_volume',
                        'total_volume', 'notional', 'refreshed_at'
                    ]),
                    pd.DataFrame(columns=[
                        'symbol', 'stock_name', 'trades', 'clients',
                        'buy_trades', 'sell_trades', 'refreshed_at'
                    ]),
                    pd.DataFrame(columns=[
                        'month', 'segment', 'active_clients', 'trades',
                        'volume', 'avg_trades_per_client', 'refreshed_at'
                    ]),
                    fact_orders,
                    order_outcomes,
                )

            fact_trades = ETLTransformer.build_fact_trades(
                transactions_df, stock_df, exchange_df, account_df
            )
            
            trading_volume = ETLTransformer.build_trading_volume(
                transactions_df, stock_df
            )
            
            instrument_activity = ETLTransformer.build_instrument_activity(
                transactions_df, stock_df
            )
            
            client_activity = ETLTransformer.build_client_activity(
                transactions_df, account_df
            )
            
            logger.info("✓ TRANSFORM PHASE COMPLETE\n")
            return fact_trades, trading_volume, instrument_activity, client_activity, fact_orders, order_outcomes
        
        except Exception as e:
            logger.error(f"✗ Transform failed: {e}")
            raise
