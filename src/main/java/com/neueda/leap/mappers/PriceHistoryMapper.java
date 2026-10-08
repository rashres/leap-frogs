package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.PricePoint;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

@Mapper
public interface PriceHistoryMapper {

    @Select("SELECT max(observed_at) FROM instrument_price WHERE instrument_id = #{instrumentId}")
    Instant findLatestObservedAt(int instrumentId);

    // The last price in each bucket, oldest first.
    @Select("""
            SELECT DISTINCT ON (bucket) observed_at, price
            FROM (
                SELECT date_bin(CAST(#{bucket} AS interval), observed_at, TIMESTAMPTZ '2000-01-01') AS bucket,
                       observed_at, price
                FROM instrument_price
                WHERE instrument_id = #{instrumentId} AND observed_at >= #{from}
            ) b
            ORDER BY bucket, observed_at DESC
            """)
    @Results({
        @Result(property = "observedAt", column = "observed_at"),
        @Result(property = "price", column = "price")
    })
    List<PricePoint> findSince(@Param("instrumentId") int instrumentId,
                               @Param("from") Instant from,
                               @Param("bucket") String bucket);
}
