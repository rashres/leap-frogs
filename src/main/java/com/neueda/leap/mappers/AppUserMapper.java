package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.AppUser;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AppUserMapper {

    @Select("""
            SELECT user_id, username, password_hash, display_name, role, account_id
            FROM app_user
            WHERE username = #{username}
            """)
    AppUser findByUsername(String username);

    @Select("""
            SELECT user_id, username, password_hash, display_name, role, account_id
            FROM app_user
            WHERE user_id = #{userId}
            """)
    AppUser findById(int userId);

    @Insert("""
            INSERT INTO app_user (username, password_hash, display_name, role, account_id)
            VALUES (#{username}, #{passwordHash}, #{displayName}, #{role}, #{accountId})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "userId", keyColumn = "user_id")
    void insert(AppUser user);
}
