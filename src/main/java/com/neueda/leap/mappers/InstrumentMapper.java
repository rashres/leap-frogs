package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Instrument;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface InstrumentMapper {

    // Instruments are rows in the "stock" table, joined with their exchange (market).
    String SELECT_WITH_EXCHANGE = """
            SELECT s.stock_id, s.symbol, s.name, s.exchange_id,
                   e.name AS exchange_name, e.country AS exchange_country
            FROM stock s
            JOIN exchange e ON e.exchange_id = s.exchange_id
            """;

    @Select(SELECT_WITH_EXCHANGE + " ORDER BY s.stock_id")
    @Results(id = "instrumentWithExchange", value = {
        @Result(property = "stockId", column = "stock_id", id = true),
        @Result(property = "exchangeId", column = "exchange_id"),
        @Result(property = "exchange.exchangeId", column = "exchange_id"),
        @Result(property = "exchange.name", column = "exchange_name"),
        @Result(property = "exchange.country", column = "exchange_country")
    })
    List<Instrument> findAll();

    @Select(SELECT_WITH_EXCHANGE + " WHERE s.stock_id = #{stockId}")
    @ResultMap("instrumentWithExchange")
    Instrument findByStockId(int stockId);
}
