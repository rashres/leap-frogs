package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.CashTransfer;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Deposits (cash_deposit) and withdrawals (cash_withdrawal). */
@Mapper
public interface CashTransferMapper {

    @Insert("INSERT INTO cash_deposit (account_id, amount) VALUES (#{accountId}, #{amount})")
    void insertDeposit(@Param("accountId") int accountId, @Param("amount") BigDecimal amount);

    @Insert("INSERT INTO cash_withdrawal (account_id, amount) VALUES (#{accountId}, #{amount})")
    void insertWithdrawal(@Param("accountId") int accountId, @Param("amount") BigDecimal amount);

    /** Deposits made after `since`, oldest first. */
    @Select("""
            SELECT deposit_id AS transfer_id, account_id, amount, deposited_at AS at FROM cash_deposit
            WHERE account_id = #{accountId} AND deposited_at > #{since}
            ORDER BY deposited_at, deposit_id
            """)
    List<CashTransfer> depositsSince(@Param("accountId") int accountId, @Param("since") Instant since);

    /** Withdrawals made after `since`, oldest first. */
    @Select("""
            SELECT withdrawal_id AS transfer_id, account_id, amount, withdrawn_at AS at FROM cash_withdrawal
            WHERE account_id = #{accountId} AND withdrawn_at > #{since}
            ORDER BY withdrawn_at, withdrawal_id
            """)
    List<CashTransfer> withdrawalsSince(@Param("accountId") int accountId, @Param("since") Instant since);
}
