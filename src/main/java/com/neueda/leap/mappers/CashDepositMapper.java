package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.CashDeposit;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Mapper
public interface CashDepositMapper {

    @Insert("INSERT INTO cash_deposit (account_id, amount) VALUES (#{accountId}, #{amount})")
    void insert(@Param("accountId") int accountId, @Param("amount") BigDecimal amount);

    /** Deposits made after `since`, oldest first. */
    @Select("""
            SELECT deposit_id, account_id, amount, deposited_at FROM cash_deposit
            WHERE account_id = #{accountId} AND deposited_at > #{since}
            ORDER BY deposited_at, deposit_id
            """)
    List<CashDeposit> findSince(@Param("accountId") int accountId, @Param("since") Instant since);
}
