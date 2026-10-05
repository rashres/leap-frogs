package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.Account;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AccountMapper {

    @Select("SELECT account_id, name, email, cash_balance FROM account ORDER BY account_id")
    List<Account> findAll();

    @Select("SELECT account_id, name, email, cash_balance FROM account WHERE account_id = #{accountId}")
    Account findById(int accountId);
    
    /**
     * Update account cash balance
     */
    @Update("UPDATE account SET cash_balance = #{cashBalance} WHERE account_id = #{accountId}")
    void updateBalance(@Param("accountId") int accountId, @Param("cashBalance") java.math.BigDecimal cashBalance);
}
