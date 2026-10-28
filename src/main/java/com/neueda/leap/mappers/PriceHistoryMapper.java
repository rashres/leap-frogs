package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.PricePoint;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Mapper
public interface PriceHistoryMapper {

    @Select("SELECT max(observed_at) FROM instrument_price WHERE instrument_id = #{instrumentId}")
    Instant findLatestObservedAt(int instrumentId);

    @Select("SELECT min(observed_at) FROM instrument_price WHERE instrument_id = #{instrumentId}")
    Instant findEarliestObservedAt(int instrumentId);

    /** The live price for this minute; a later fetch in the same minute replaces it. */
    @Insert("""
            INSERT INTO instrument_price (instrument_id, observed_at, price)
            VALUES (#{instrumentId}, #{observedAt}, #{price})
            ON CONFLICT (instrument_id, observed_at) DO UPDATE SET price = EXCLUDED.price
            """)
    void upsert(@Param("instrumentId") int instrumentId, @Param("observedAt") Instant observedAt,
                @Param("price") BigDecimal price);

    /** A backfilled bar; never overwrites a price already recorded. */
    @Insert("""
            INSERT INTO instrument_price (instrument_id, observed_at, price)
            VALUES (#{instrumentId}, #{observedAt}, #{price})
            ON CONFLICT (instrument_id, observed_at) DO NOTHING
            """)
    void insertIfAbsent(@Param("instrumentId") int instrumentId, @Param("observedAt") Instant observedAt,
                        @Param("price") BigDecimal price);

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
