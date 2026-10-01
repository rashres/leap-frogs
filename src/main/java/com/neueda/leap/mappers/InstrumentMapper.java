package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import com.neueda.leap.services.domain.Instrument;

@Mapper

public interface InstrumentMapper {
    @Select("SELECT instrument_id, symbol, name, exchange_id from instrument WHERE instrument_id=#{instrument_id}")
    Instrument findByInstrumentId(int instrument_id);
}
