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

    // Instruments are rows in the "instrument" table, joined with their exchange (market).
    String SELECT_WITH_EXCHANGE = """
            SELECT i.instrument_id, i.symbol, i.name, i.exchange_id,
                   e.name AS exchange_name, e.country AS exchange_country
            FROM instrument i
            JOIN exchange e ON e.exchange_id = i.exchange_id
            """;

    @Select(SELECT_WITH_EXCHANGE + " ORDER BY i.instrument_id")
    @Results(id = "instrumentWithExchange", value = {
        @Result(property = "instrumentId", column = "instrument_id", id = true),
        @Result(property = "exchangeId", column = "exchange_id"),
        @Result(property = "exchange.exchangeId", column = "exchange_id"),
        @Result(property = "exchange.name", column = "exchange_name"),
        @Result(property = "exchange.country", column = "exchange_country")
    })
    List<Instrument> findAll();

    @Select(SELECT_WITH_EXCHANGE + " WHERE i.instrument_id = #{instrumentId}")
    @ResultMap("instrumentWithExchange")
    Instrument findByInstrumentId(int instrumentId);
}
