package com.neueda.leap.mappers;

import com.neueda.leap.services.domain.CopiedOrder;
import com.neueda.leap.services.domain.CopyLedgerEntry;
import com.neueda.leap.services.domain.CopySubscription;
import com.neueda.leap.services.domain.CopyTrader;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

// Lead traders (copy_trader), who follows them (copy_subscription) and which
// follower orders were copies (copy_trade). Tables: database/copy-trading-schema.sql.
@Mapper
public interface CopyTradingMapper {

    // A subscription is active while stopped_at is NULL.
    String SELECT_TRADER = """
            SELECT ct.copy_trader_id, ct.account_id, a.name, ct.handle, ct.strategy, ct.markets, ct.bio,
                   ct.risk_level, ct.starting_capital, ct.created_at,
                   a.cash_balance + COALESCE((SELECT SUM(h.quantity * i.last_price)
                                              FROM holdings h JOIN instrument i ON i.instrument_id = h.instrument_id
                                              WHERE h.account_id = ct.account_id), 0) AS equity,
                   (SELECT COUNT(*) FROM copy_subscription s
                    WHERE s.copy_trader_id = ct.copy_trader_id AND s.stopped_at IS NULL) AS followers,
                   (SELECT COALESCE(SUM(s.allocation), 0) FROM copy_subscription s
                    WHERE s.copy_trader_id = ct.copy_trader_id AND s.stopped_at IS NULL) AS copier_funds
            FROM copy_trader ct
            JOIN account a ON a.account_id = ct.account_id
            """;

    String SELECT_SUBSCRIPTION = """
            SELECT s.subscription_id, s.follower_account_id, s.copy_trader_id, a.name AS trader_name,
                   ct.handle AS trader_handle, s.allocation, s.max_per_trade, s.stop_loss_percent,
                   s.sell_on_stop_loss, s.paused_at, s.pause_reason, s.started_at, s.stopped_at,
                   (SELECT COUNT(*) FROM copy_trade c WHERE c.subscription_id = s.subscription_id) AS copied_orders
            FROM copy_subscription s
            JOIN copy_trader ct ON ct.copy_trader_id = s.copy_trader_id
            JOIN account a ON a.account_id = ct.account_id
            """;

    @Select(SELECT_TRADER + " ORDER BY ct.copy_trader_id")
    List<CopyTrader> findTraders();

    @Select(SELECT_TRADER + " WHERE ct.copy_trader_id = #{copyTraderId}")
    CopyTrader findTraderById(int copyTraderId);

    /** The trader profile of an account, or null when the account is not a lead trader. */
    @Select(SELECT_TRADER + " WHERE ct.account_id = #{accountId}")
    CopyTrader findTraderByAccountId(int accountId);

    /** The account's active subscriptions, oldest first. */
    @Select(SELECT_SUBSCRIPTION + """
            WHERE s.follower_account_id = #{accountId} AND s.stopped_at IS NULL
            ORDER BY s.started_at, s.subscription_id
            """)
    List<CopySubscription> findActiveByFollower(int accountId);

    /** Everyone currently copying the trader. */
    @Select(SELECT_SUBSCRIPTION + """
            WHERE s.copy_trader_id = #{copyTraderId} AND s.stopped_at IS NULL
            ORDER BY s.subscription_id
            """)
    List<CopySubscription> findActiveByTrader(int copyTraderId);

    @Select(SELECT_SUBSCRIPTION + " WHERE s.subscription_id = #{subscriptionId}")
    CopySubscription findSubscriptionById(int subscriptionId);

    /** Active copies with a stop-loss that it has not already tripped. */
    @Select(SELECT_SUBSCRIPTION + """
            WHERE s.stopped_at IS NULL AND s.stop_loss_percent IS NOT NULL
              AND s.pause_reason IS DISTINCT FROM 'STOP_LOSS'
            ORDER BY s.subscription_id
            """)
    List<CopySubscription> findStopLossWatched();

    @Insert("""
            INSERT INTO copy_subscription (follower_account_id, copy_trader_id, allocation, max_per_trade,
                                           stop_loss_percent, sell_on_stop_loss, started_at)
            VALUES (#{followerAccountId}, #{copyTraderId}, #{allocation}, #{maxPerTrade},
                    #{stopLossPercent}, #{sellOnStopLoss}, #{startedAt})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "subscriptionId", keyColumn = "subscription_id")
    void insertSubscription(CopySubscription subscription);

    /** Saves an active copy's settings and pause state; returns 0 if the account has no such active copy. */
    @Update("""
            UPDATE copy_subscription
            SET allocation = #{s.allocation}, max_per_trade = #{s.maxPerTrade}, stop_loss_percent = #{s.stopLossPercent},
                sell_on_stop_loss = #{s.sellOnStopLoss}, paused_at = #{s.pausedAt}, pause_reason = #{s.pauseReason}
            WHERE subscription_id = #{s.subscriptionId} AND follower_account_id = #{s.followerAccountId}
              AND stopped_at IS NULL
            """)
    int updateSettings(@Param("s") CopySubscription subscription);

    /** Pauses an active copy for its stop-loss; returns 0 if it is stopped or the stop-loss already paused it. */
    @Update("""
            UPDATE copy_subscription SET paused_at = #{at}, pause_reason = 'STOP_LOSS'
            WHERE subscription_id = #{subscriptionId} AND stopped_at IS NULL
              AND pause_reason IS DISTINCT FROM 'STOP_LOSS'
            """)
    int pauseForStopLoss(@Param("subscriptionId") int subscriptionId, @Param("at") Instant at);

    /** The copy's filled and pending orders, oldest fill first, for CopyBook. */
    @Select("""
            SELECT t.instrument_id, t.transaction_type AS side, t.status, t.quantity, t.price, t.limit_price,
                   i.last_price
            FROM copy_trade c
            JOIN transactions t ON t.transaction_id = c.follower_transaction_id
            JOIN instrument i ON i.instrument_id = t.instrument_id
            WHERE c.subscription_id = #{subscriptionId} AND t.status IN ('COMPLETE', 'PENDING')
            ORDER BY COALESCE(t.filled_at, t.transaction_time), t.transaction_id
            """)
    List<CopyLedgerEntry> findLedger(int subscriptionId);

    /** Stops an active subscription; returns 0 if the account has no such active subscription. */
    @Update("""
            UPDATE copy_subscription SET stopped_at = #{at}
            WHERE subscription_id = #{subscriptionId} AND follower_account_id = #{accountId} AND stopped_at IS NULL
            """)
    int stopSubscription(@Param("accountId") int accountId, @Param("subscriptionId") int subscriptionId,
                         @Param("at") Instant at);

    @Insert("""
            INSERT INTO copy_trade (follower_transaction_id, leader_transaction_id, subscription_id)
            VALUES (#{followerOrderId}, #{leaderOrderId}, #{subscriptionId})
            """)
    void insertCopyTrade(@Param("followerOrderId") int followerOrderId, @Param("leaderOrderId") Integer leaderOrderId,
                         @Param("subscriptionId") int subscriptionId);

    /** Every order of the account that was copied from a lead trader, stopped subscriptions included. */
    @Select("""
            SELECT c.follower_transaction_id AS order_id, c.leader_transaction_id AS leader_order_id,
                   s.copy_trader_id, a.name AS trader_name, ct.handle AS trader_handle
            FROM copy_trade c
            JOIN transactions t ON t.transaction_id = c.follower_transaction_id
            JOIN copy_subscription s ON s.subscription_id = c.subscription_id
            JOIN copy_trader ct ON ct.copy_trader_id = s.copy_trader_id
            JOIN account a ON a.account_id = ct.account_id
            WHERE t.account_id = #{accountId}
            ORDER BY c.follower_transaction_id DESC
            """)
    List<CopiedOrder> findCopiedOrders(int accountId);
}
