/**
 * Order placement, lifecycle and history.
 *
 * Models the write-side flow the backend will own:
 *   SUBMITTED -> (pre-trade validation) -> ACCEPTED | REJECTED
 *   ACCEPTED  -> FILLED | CANCELLED
 *
 * No state is skipped and every transition is recorded, which is what US-09
 * streams and what US-14 lists. On the backend the fill is one transaction
 * covering the state change, position, ledger entry, audit event and outbox
 * event (US-11 / BR-09); here `fill()` performs the equivalent single atomic
 * update so no render can see a half-applied trade.
 *
 * [US-05][US-06][US-07][US-08][US-09][US-14]
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Decimal } from '../money/decimal';
import type { Money } from '../money/money';
import { policyFor, type Instrument } from '../domain/instrument';
import {
  canTransition,
  type Order,
  type OrderSide,
  type OrderState,
  type OrderTransition,
  type PreTradeOutcome,
  type QuoteSnapshot,
} from '../domain/order';
import { MarketDataService } from './market-data.service';
import { PortfolioService } from './portfolio.service';
import { PreTradeValidator } from './pre-trade-validator';
import { DemoStore } from './persistence';
import { DEMO_ACCOUNT_ID } from './fixtures';

/** Simulated venue latency between acceptance and fill, so US-09 has something to show. */
const EXECUTION_DELAY_MS = 1_400;

export interface PlaceOrderRequest {
  readonly instrument: Instrument;
  readonly side: OrderSide;
  readonly quantity: Decimal;
  /** [US-16] The quote shown to the client at the moment they pressed the button. */
  readonly indicativeQuote: QuoteSnapshot;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly market = inject(MarketDataService);
  private readonly portfolio = inject(PortfolioService);
  private readonly validator = inject(PreTradeValidator);
  private readonly store = inject(DemoStore);

  private readonly restored = this.store.restoreOrders();

  /**
   * Per-instance so a restored session continues its reference numbering rather
   * than reissuing LEAP-…-00001 over an order that already exists.
   */
  private sequence = this.restored?.nextSequence ?? 1;

  private readonly all = signal<readonly Order[]>(this.restored?.orders ?? []);

  constructor() {
    effect(() => this.store.saveOrders(this.all(), this.sequence));

    // An order restored mid-flight has lost the timer that would have filled it.
    // Re-arm execution rather than leaving it Accepted forever.
    if (typeof window !== 'undefined') {
      for (const order of this.all()) {
        if (order.state === 'ACCEPTED') {
          setTimeout(() => this.fill(order.id), EXECUTION_DELAY_MS);
        }
      }
    }
  }

  /** [US-14] Order history, newest first. */
  readonly orders = computed(() =>
    [...this.all()].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()),
  );

  /** [US-09] Orders still in flight, for the live status strip. */
  readonly workingOrders = computed(() =>
    this.orders().filter((order) => order.state === 'SUBMITTED' || order.state === 'ACCEPTED'),
  );

  readonly filledOrders = computed(() => this.orders().filter((order) => order.state === 'FILLED'));

  ordersFor(instrumentId: string) {
    return this.orders().filter((order) => order.instrumentId === instrumentId);
  }

  /**
   * Computes consideration from a unit price and quantity.
   *
   * Rounding is HALF_UP — away from zero — so a half-unit remainder resolves in
   * the platform's favour rather than the client's on a buy. Stated explicitly
   * because CLAUDE.md requires a declared rounding mode at every arithmetic site.
   */
  considerationFor(price: Money, quantity: Decimal): Money {
    return price.timesQuantity(quantity, 'HALF_UP');
  }

  /** Runs validation without placing anything, to drive the live ticket preview. */
  preview(request: Omit<PlaceOrderRequest, 'indicativeQuote'> & { price: Money }): PreTradeOutcome {
    return this.validator.validate({
      instrument: request.instrument,
      side: request.side,
      quantity: request.quantity,
      consideration: this.considerationFor(request.price, request.quantity),
    });
  }

  /**
   * [US-05][US-06] Places an order and drives it through its lifecycle.
   *
   * Returns the order as it stands after validation — ACCEPTED or REJECTED.
   * An accepted order fills asynchronously and its state updates in place.
   */
  place(request: PlaceOrderRequest): Order {
    const { instrument, side, quantity, indicativeQuote } = request;
    const now = new Date();
    const id = `ord-${String(this.sequence).padStart(6, '0')}`;
    const reference = `LEAP-${now.getFullYear()}-${String(this.sequence).padStart(5, '0')}`;
    this.sequence += 1;

    const submitted: Order = {
      id,
      reference,
      accountId: DEMO_ACCOUNT_ID,
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      instrumentName: instrument.name,
      currency: instrument.currency,
      side,
      quantity,
      state: 'SUBMITTED',
      submittedAt: now,
      indicativeQuote,
      transitions: [
        {
          at: now,
          from: null,
          to: 'SUBMITTED',
          detail: `${side} ${quantity.toTrimmedString()} ${instrument.symbol} at indicative ${indicativeQuote.price.format()}`,
        },
      ],
    };
    this.all.update((orders) => [...orders, submitted]);

    // [US-07] Validation decides acceptance. Rejection is recorded, not thrown.
    const outcome = this.validator.validate({
      instrument,
      side,
      quantity,
      consideration: this.considerationFor(indicativeQuote.price, quantity),
    });

    if (outcome.kind === 'REJECTED') {
      this.transition(id, 'REJECTED', `Rejected: ${outcome.reason.code} — ${outcome.reason.message}`, (order) => ({
        ...order,
        rejectionReason: outcome.reason,
      }));
      return this.require(id);
    }

    this.transition(id, 'ACCEPTED', 'Passed pre-trade validation; routed for execution');

    if (typeof window !== 'undefined') {
      setTimeout(() => this.fill(id), EXECUTION_DELAY_MS);
    }
    return this.require(id);
  }

  /** Cancels a working order. Only ACCEPTED orders can be cancelled. */
  cancel(orderId: string): void {
    const order = this.all().find((candidate) => candidate.id === orderId);
    if (!order || !canTransition(order.state, 'CANCELLED')) return;
    this.transition(orderId, 'CANCELLED', 'Cancelled by client before execution');
  }

  /**
   * [US-10][BR-08][BR-14] Executes against the latest quote.
   *
   * The execution quote is read here, at fill time — not reused from the
   * indicative quote the client saw. The two are recorded as separate facts, so
   * any slippage between them is visible on the order forever after.
   */
  private fill(orderId: string): void {
    const order = this.all().find((candidate) => candidate.id === orderId);
    if (!order || !canTransition(order.state, 'FILLED')) return;

    const executionQuote = this.market.quoteForExecution(order.instrumentId);
    const snapshot: QuoteSnapshot = {
      rate: executionQuote.rate,
      price: executionQuote.price,
      observedAt: executionQuote.observedAt,
    };
    const consideration = this.considerationFor(snapshot.price, order.quantity);

    // [US-11][BR-09] Position, cash and order state move together.
    this.portfolio.applyFill({
      instrumentId: order.instrumentId,
      side: order.side,
      quantity: order.quantity,
      consideration,
    });

    this.transition(
      orderId,
      'FILLED',
      `Filled ${order.quantity.toTrimmedString()} at ${snapshot.price.format()} ` +
        `(quote observed ${snapshot.observedAt.toLocaleTimeString('en-GB')})`,
      (current) => ({
        ...current,
        executionQuote: snapshot,
        consideration: order.side === 'BUY' ? consideration.negated() : consideration,
        filledAt: new Date(),
      }),
    );
  }

  /** Applies a validated state change and appends its transition record. */
  private transition(
    orderId: string,
    to: OrderState,
    detail: string,
    patch?: (order: Order) => Order,
  ): void {
    this.all.update((orders) =>
      orders.map((order) => {
        if (order.id !== orderId) return order;
        if (!canTransition(order.state, to)) {
          throw new Error(`Illegal order transition ${order.state} -> ${to} on ${order.reference}`);
        }
        const record: OrderTransition = { at: new Date(), from: order.state, to, detail };
        const next: Order = { ...order, state: to, transitions: [...order.transitions, record] };
        return patch ? patch(next) : next;
      }),
    );
  }

  private require(orderId: string): Order {
    const order = this.all().find((candidate) => candidate.id === orderId);
    if (!order) throw new Error(`Unknown order: ${orderId}`);
    return order;
  }

  /** Largest quantity the account could buy of an instrument with its settlement-currency cash. */
  maxBuyQuantity(instrument: Instrument, price: Money): Decimal {
    const policy = policyFor(instrument.classCode);
    const cash = this.portfolio.cashFor(instrument.currency);
    if (price.isZero()) return Decimal.zero(policy.quantityScale);
    return cash.amount.divide(price.amount, policy.quantityScale, 'DOWN');
  }
}
