package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Account;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AccountMapper {

    @Select("SELECT account_id, name, email, cash_balance, status FROM account ORDER BY account_id")
    List<Account> findAll();

    @Select("SELECT account_id, name, email, cash_balance, status FROM account WHERE account_id = #{accountId}")
    Account findById(int accountId);

    @Select("""
            SELECT account_id, name, email, cash_balance, status FROM account
            WHERE (CAST(#{q} AS VARCHAR) IS NULL OR CAST(#{q} AS VARCHAR) = ''
                   OR lower(name) LIKE '%' || lower(CAST(#{q} AS VARCHAR)) || '%'
                   OR lower(email) LIKE '%' || lower(CAST(#{q} AS VARCHAR)) || '%')
              AND (CAST(#{status} AS VARCHAR) IS NULL OR CAST(#{status} AS VARCHAR) = ''
                   OR status = CAST(#{status} AS VARCHAR))
            ORDER BY account_id
            """)
    List<Account> search(@Param("q") String q, @Param("status") String status);

    /**
     * Update account cash balance
     */
    @Update("UPDATE account SET cash_balance = #{cashBalance} WHERE account_id = #{accountId}")
    void updateBalance(@Param("accountId") int accountId, @Param("cashBalance") java.math.BigDecimal cashBalance);

    @Update("UPDATE account SET status = #{status} WHERE account_id = #{accountId}")
    int updateStatus(@Param("accountId") int accountId, @Param("status") String status);
}
