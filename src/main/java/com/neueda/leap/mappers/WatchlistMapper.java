package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

// An account's starred instruments are rows in the "watchlist" table, ordered by position.
@Mapper
public interface WatchlistMapper {

    @Select("SELECT instrument_id FROM watchlist WHERE account_id = #{accountId} ORDER BY position")
    List<Integer> findInstrumentIds(int accountId);

    /** Drops every instrument not in `keep`; an empty `keep` clears the list. */
    @Delete("""
            <script>
            DELETE FROM watchlist WHERE account_id = #{accountId}
            <if test="keep.size() > 0">
              AND instrument_id NOT IN
              <foreach item="id" collection="keep" open="(" separator="," close=")">#{id}</foreach>
            </if>
            </script>
            """)
    void deleteExcept(@Param("accountId") int accountId, @Param("keep") List<Integer> keep);

    /** Adds an instrument at `position`, or moves it there; added_at keeps its first value. */
    @Insert("""
            INSERT INTO watchlist (account_id, instrument_id, position)
            VALUES (#{accountId}, #{instrumentId}, #{position})
            ON CONFLICT (account_id, instrument_id) DO UPDATE SET position = EXCLUDED.position
            """)
    void upsert(@Param("accountId") int accountId, @Param("instrumentId") int instrumentId, @Param("position") int position);
}
