package com.neueda.leap.mappers;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface AccountStatusEventMapper {

    @Insert("""
            INSERT INTO account_status_event (account_id, actor_user_id, action, reason)
            VALUES (#{accountId}, #{actorUserId}, #{action}, #{reason})
            """)
    void insert(@Param("accountId") int accountId,
                @Param("actorUserId") int actorUserId,
                @Param("action") String action,
                @Param("reason") String reason);

    @Select("""
            SELECT e.event_id AS "eventId", e.account_id AS "accountId", e.actor_user_id AS "actorUserId",
                   u.username AS "actorUsername", e.action, e.reason, e.occurred_at AS "occurredAt"
            FROM account_status_event e
            JOIN app_user u ON u.user_id = e.actor_user_id
            WHERE e.account_id = #{accountId}
            ORDER BY e.occurred_at DESC
            LIMIT 50
            """)
    List<Map<String, Object>> findRecentForAccount(int accountId);
}
