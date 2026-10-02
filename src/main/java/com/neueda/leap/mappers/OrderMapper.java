package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import java.util.List;
import com.neueda.leap.services.domain.Order;

@Mapper
public interface OrderMapper {
    
    /**
     * Get all orders for a specific account
     */
    @Select("SELECT order_id, account_id, instrument_id, side, quantity, price, status, placed_time, fulfilled_time FROM orders WHERE account_id = #{account_id}")
    List<Order> findByAccountId(@Param("account_id") int account_id);
    
    /**
     * Insert a new order into the database
     */
    @Insert("INSERT INTO orders (account_id, instrument_id, side, quantity, price, status, placed_time) VALUES (#{account.id}, #{instrument.id}, #{side}, #{quantity}, #{price}, #{status}, #{placed_time})")
    void insertOrder(Order order);
}
