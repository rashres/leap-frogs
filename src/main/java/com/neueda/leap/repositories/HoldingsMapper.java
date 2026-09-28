package com.neueda.leap.repositories;

import org.apache.ibatis.annotations.Mapper;

public interface HoldingsMapper {
    @Select("SELECT holding_id, stock_id, quantity from holdings WHERE holding_id= #{holding_id}")
    Holding findById(int holding_id);
    
}


//public interface AdvisorMapper {

  //  @Select("SELECT advisor_id, name, region FROM advisors WHERE advisor_id = #{advisorId}")
  //  Advisor findById(int advisorId);
//}