package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Order;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// Orders are stored as rows in the "transactions" table (one row per order, whatever its status).
@Mapper
public interface OrderMapper {

    // Rows before filled_at existed filled at transaction_time.
    String SELECT_ORDER = """
            SELECT t.transaction_id, t.account_id, t.instrument_id, i.symbol,
                   t.transaction_type, t.quantity, t.price, t.status, t.transaction_time,
                   t.order_type, t.limit_price, t.time_in_force, t.expires_at,
                   CASE WHEN t.status = 'COMPLETE' THEN COALESCE(t.filled_at, t.transaction_time) END AS fulfilled_time
            FROM transactions t
            JOIN instrument i ON i.instrument_id = t.instrument_id
            """;

    /**
     * Get all orders for a specific account, newest first
     */
    @Select(SELECT_ORDER + """
            WHERE t.account_id = #{accountId}
            ORDER BY t.transaction_time DESC, t.transaction_id DESC
            """)
    @Results(id = "orderRow", value = {
        @Result(property = "orderId", column = "transaction_id", id = true),
        @Result(property = "account.accountId", column = "account_id"),
        @Result(property = "instrument.instrumentId", column = "instrument_id"),
        @Result(property = "instrument.symbol", column = "symbol"),
        @Result(property = "side", column = "transaction_type"),
        @Result(property = "quantity", column = "quantity"),
        @Result(property = "price", column = "price"),
        @Result(property = "placedTime", column = "transaction_time"),
        @Result(property = "orderType", column = "order_type"),
        @Result(property = "limitPrice", column = "limit_price"),
        @Result(property = "timeInForce", column = "time_in_force"),
        @Result(property = "expiresAt", column = "expires_at"),
        // Must come before "status": setStatus("COMPLETE") only fills fulfilledTime when it is still empty.
        @Result(property = "fulfilledTime", column = "fulfilled_time"),
        @Result(property = "status", column = "status")
    })
    List<Order> findByAccountId(int accountId);

    @Select(SELECT_ORDER + """
            WHERE t.transaction_time >= #{startDate}
                AND t.transaction_time <= #{endDate}
            ORDER BY t.transaction_time DESC, t.transaction_id DESC
            """)
    @ResultMap("orderRow")
    List<Order> findByDate(LocalDate startDate, LocalDate endDate);

    /** Get orders using any combination of account and date filters. */
    @Select("""
            <script>
            SELECT t.transaction_id, t.account_id, t.instrument_id, i.symbol,
                   t.transaction_type, t.quantity, t.price, t.status, t.transaction_time,
                   t.order_type, t.limit_price, t.time_in_force, t.expires_at,
                   CASE WHEN t.status = 'COMPLETE' THEN COALESCE(t.filled_at, t.transaction_time) END AS fulfilled_time
            FROM transactions t
            JOIN instrument i ON i.instrument_id = t.instrument_id
            <where>
                <if test='accountId != null'>
                    t.account_id = #{accountId}
                </if>
                <if test='startDate != null'>
                    AND t.transaction_time &gt;= #{startDate}
                </if>
                <if test='endDate != null'>
                    AND t.transaction_time &lt;= #{endDate}
                </if>
            </where>
            ORDER BY t.transaction_time DESC, t.transaction_id DESC
            </script>
            """)
    @ResultMap("orderRow")
    List<Order> findByFilters(Integer accountId, LocalDateTime startDate, LocalDateTime endDate);

    @Select(SELECT_ORDER + " WHERE t.transaction_id = #{orderId}")
    @ResultMap("orderRow")
    Order findById(int orderId);

    /** Every order still waiting to fill, oldest first so earlier orders get first claim on cash. */
    @Select(SELECT_ORDER + " WHERE t.status = 'PENDING' ORDER BY t.transaction_time, t.transaction_id")
    @ResultMap("orderRow")
    List<Order> findPending();

    /**
     * Insert a new order; the generated transaction_id is written back into order.orderId
     */
    @Insert("""
            INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, status, transaction_time,
                                      order_type, limit_price, time_in_force, expires_at, filled_at)
            VALUES (#{account.accountId}, #{instrument.instrumentId}, #{side}, #{quantity}, #{price}, #{status}, #{placedTime},
                    #{orderType}, #{limitPrice}, #{timeInForce}, #{expiresAt}, #{fulfilledTime})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "orderId", keyColumn = "transaction_id")
    void insertOrder(Order order);

    /**
     * Cash the account's pending buys are holding back: each at its limit price,
     * or a market order at the price it was placed at (see Order.getReservedValue).
     */
    @Select("""
            SELECT COALESCE(SUM(quantity * COALESCE(limit_price, price)), 0)
            FROM transactions
            WHERE account_id = #{accountId} AND status = 'PENDING' AND transaction_type = 'BUY'
            """)
    BigDecimal reservedCash(int accountId);

    /** Shares of one instrument the account's pending sells are holding back. */
    @Select("""
            SELECT COALESCE(SUM(quantity), 0)
            FROM transactions
            WHERE account_id = #{accountId} AND instrument_id = #{instrumentId}
              AND status = 'PENDING' AND transaction_type = 'SELL'
            """)
    BigDecimal reservedShares(@Param("accountId") int accountId, @Param("instrumentId") int instrumentId);

    /**
     * Marks a pending order filled. Matches only while it is still PENDING, so
     * a fill and a cancel racing for the same order cannot both win: the caller
     * checks for 1 row before touching cash or holdings.
     */
    @Update("""
            UPDATE transactions SET status = 'COMPLETE', price = #{price}, filled_at = #{filledAt}
            WHERE transaction_id = #{orderId} AND status = 'PENDING'
            """)
    int markFilled(@Param("orderId") int orderId, @Param("price") BigDecimal price, @Param("filledAt") Instant filledAt);

    /** Moves a pending order to CANCELLED, EXPIRED or FAILED; returns 0 if it was no longer pending. */
    @Update("UPDATE transactions SET status = #{status} WHERE transaction_id = #{orderId} AND status = 'PENDING'")
    int closePending(@Param("orderId") int orderId, @Param("status") String status);
}
