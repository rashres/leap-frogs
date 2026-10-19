package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.AppUser;
import org.apache.ibatis.annotations.Mapper;
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
}
