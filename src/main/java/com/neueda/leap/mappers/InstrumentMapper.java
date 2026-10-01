package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import com.neueda.leap.services.domain.Instrument;
import java.util.List;

@Mapper

public interface InstrumentMapper {
    @Select("SELECT stock_id symbol, name from stock WHERE stock_id=#{stock_id}")
    Instrument findByStockId(int stock_id);
}