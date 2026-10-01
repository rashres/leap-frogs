package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import com.neueda.leap.services.domain.Instrument;
import java.util.List;

@Mapper

public interface InstrumentMapper {
    @Select("SELECT instrument_id, symbol, name, exchange_id from instrument WHERE instrument_id=#{instrument_id}")
    List<Instrument> findByInstrumentId(int instrument_id);
}