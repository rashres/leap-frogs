package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Order;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

// Orders are stored as rows in the "transactions" table (one row per order, COMPLETE or FAILED).
@Mapper
public interface OrderMapper {

    /**
     * Get all orders for a specific account, newest first
     */
    @Select("""
            SELECT t.transaction_id, t.account_id, t.instrument_id, i.symbol,
                   t.transaction_type, t.quantity, t.price, t.status, t.transaction_time,
                   CASE WHEN t.status = 'COMPLETE' THEN t.transaction_time END AS fulfilled_time
            FROM transactions t
            JOIN instrument i ON i.instrument_id = t.instrument_id
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
        // Must come before "status": setStatus("COMPLETE") only fills fulfilledTime when it is still empty.
        @Result(property = "fulfilledTime", column = "fulfilled_time"),
        @Result(property = "status", column = "status")
    })
    List<Order> findByAccountId(int accountId);

    @Select("""
            SELECT t.transaction_id, t.account_id, t.instrument_id, i.symbol,
                   t.transaction_type, t.quantity, t.price, t.status, t.transaction_time,
                   CASE WHEN t.status = 'COMPLETE' THEN t.transaction_time END AS fulfilled_time
            FROM transactions t
            JOIN instrument i ON i.instrument_id = t.instrument_id
            WHERE t.transaction_time >= #{startDate}
                AND t.transaction_time <= #{endDate}
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
            // Must come before "status": setStatus("COMPLETE") only fills fulfilledTime when it is still empty.
            @Result(property = "fulfilledTime", column = "fulfilled_time"),
            @Result(property = "status", column = "status")
    })
    List<Order> findByDate(LocalDate startDate, LocalDate endDate);

    /**
     * Insert a new order; the generated transaction_id is written back into order.orderId
     */
    @Insert("""
            INSERT INTO transactions (account_id, instrument_id, transaction_type, quantity, price, status, transaction_time)
            VALUES (#{account.accountId}, #{instrument.instrumentId}, #{side}, #{quantity}, #{price}, #{status}, #{placedTime})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "orderId", keyColumn = "transaction_id")
    void insertOrder(Order order);
}
