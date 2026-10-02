package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import com.neueda.leap.services.domain.Holding;

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
}
