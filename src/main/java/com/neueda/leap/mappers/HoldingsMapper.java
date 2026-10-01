package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import com.neueda.leap.services.domain.Holding;

@Mapper
public interface HoldingsMapper {
    @Select("SELECT holding_id, stock_id, quantity from holdings WHERE holding_id= #{holding_id}")
    Holding findById(int holding_id);
}