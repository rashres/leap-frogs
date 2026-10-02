package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Holding;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface HoldingsMapper {
    
    /**
     * Find holding by account ID and instrument ID
     */
    @Select("SELECT holding_id, account_id, instrument_id, quantity, updated_at FROM holdings WHERE account_id = #{accountId} AND instrument_id = #{instrumentId}")
    Holding findByAccountIdAndInstrumentId(@Param("accountId") int accountId, @Param("instrumentId") int instrumentId);
    
    /**
     * Insert or update a holding (upsert)
     */
    @Insert("INSERT INTO holdings (account_id, instrument_id, quantity, updated_at) " +
            "VALUES (#{accountId}, #{instrument.id}, #{quantity}, #{updatedAt}) " +
            "ON CONFLICT (account_id, instrument_id) DO UPDATE SET " +
            "quantity = EXCLUDED.quantity, updated_at = EXCLUDED.updated_at")
    void upsertHolding(Holding holding);

    // Every market in one list: zero-quantity rows are positions that were fully sold.
    @Select("""
            SELECT h.holding_id, h.account_id, h.quantity,
                   i.instrument_id, i.symbol, i.name AS instrument_name, i.exchange_id,
                   e.name AS exchange_name, e.country AS exchange_country
            FROM holdings h
            JOIN instrument i ON i.instrument_id = h.instrument_id
            JOIN exchange e   ON e.exchange_id = i.exchange_id
            WHERE h.account_id = #{accountId} AND h.quantity > 0
            ORDER BY i.symbol
            """)
    @Results(id = "holdingWithInstrument", value = {
        @Result(property = "holdingId", column = "holding_id", id = true),
        @Result(property = "accountId", column = "account_id"),
        @Result(property = "quantity", column = "quantity"),
        @Result(property = "instrument.instrumentId", column = "instrument_id"),
        @Result(property = "instrument.symbol", column = "symbol"),
        @Result(property = "instrument.name", column = "instrument_name"),
        @Result(property = "instrument.exchangeId", column = "exchange_id"),
        @Result(property = "instrument.exchange.exchangeId", column = "exchange_id"),
        @Result(property = "instrument.exchange.name", column = "exchange_name"),
        @Result(property = "instrument.exchange.country", column = "exchange_country")
    })
    List<Holding> findByAccountId(int accountId);
}
