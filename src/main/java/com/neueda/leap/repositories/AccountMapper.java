package com.neueda.leap.repositories;

import com.neueda.leap.services.domain.Account;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AccountMapper {

    @Select("SELECT account_id, name, email, cash_balance FROM account ORDER BY account_id")
    List<Account> findAll();

    @Select("SELECT account_id, name, email, cash_balance FROM account WHERE account_id = #{accountId}")
    Account findById(int accountId);
}
