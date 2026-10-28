package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Instrument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface InstrumentMapper {

    // Instruments are rows in the "instrument" table, joined with their exchange (market).
    String SELECT_WITH_EXCHANGE = """
            SELECT i.instrument_id, i.symbol, i.name, i.exchange_id,
                   i.last_price, i.price_updated_at,
                   e.name AS exchange_name, e.country AS exchange_country
            FROM instrument i
            JOIN exchange e ON e.exchange_id = i.exchange_id
            """;

    @Select(SELECT_WITH_EXCHANGE + " ORDER BY i.instrument_id")
    @Results(id = "instrumentWithExchange", value = {
        @Result(property = "instrumentId", column = "instrument_id", id = true),
        @Result(property = "exchangeId", column = "exchange_id"),
        @Result(property = "lastPrice", column = "last_price"),
        @Result(property = "priceUpdatedAt", column = "price_updated_at"),
        @Result(property = "exchange.exchangeId", column = "exchange_id"),
        @Result(property = "exchange.name", column = "exchange_name"),
        @Result(property = "exchange.country", column = "exchange_country")
    })
    List<Instrument> findAll();

    @Select(SELECT_WITH_EXCHANGE + " WHERE i.instrument_id = #{instrumentId}")
    @ResultMap("instrumentWithExchange")
    Instrument findByInstrumentId(int instrumentId);

    /** The latest price in USD, as the live price updater writes it. */
    @Update("UPDATE instrument SET last_price = #{price}, price_updated_at = now() WHERE instrument_id = #{instrumentId}")
    int updateLastPrice(@Param("instrumentId") int instrumentId, @Param("price") BigDecimal price);
}
