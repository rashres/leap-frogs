/**
 * Demo-only persistence to localStorage.
 *
 * WHAT THIS IS NOT: this is **not US-08**. US-08 requires accepted orders to be
 * persisted by the platform, which means a database, a transaction boundary and
 * an audit trail. A browser's localStorage is none of those: it is per-device,
 * clearable by the user, trivially forgeable, and invisible to any back office.
 * Its only job here is that a demo survives a page reload instead of silently
 * losing every order the moment someone refreshes. See docs/open-questions.md.
 *
 * The serialisation is hand-written for one specific reason: `Decimal` stores
 * its value as a `bigint`, and `JSON.stringify` throws on bigint rather than
 * coercing it. Money must round-trip EXACTLY — a lossy encode here would
 * reintroduce the float error the whole money layer exists to prevent — so
 * every amount is stored as its integer unscaled units plus a scale, as text.
 *
 * [chore]
 */

import { Injectable } from '@angular/core';
import { Decimal } from '../money/decimal';
import { Money } from '../money/money';
import type { CurrencyCode } from '../money/currency';
import type { CashBalance, Position } from '../domain/portfolio';
import type {
  Order,
  OrderSide,
  OrderState,
  OrderTransition,
  QuoteSnapshot,
  RejectionReason,
} from '../domain/order';

/** Bumping this discards older shapes rather than crashing on them. */
const STORAGE_KEY = 'leap.demo.v1';

// ---- Wire formats ----------------------------------------------------------

/** A Decimal as integer units + scale. `u` is text because it is a bigint. */
interface DecimalDto {
  readonly u: string;
  readonly s: number;
}

interface MoneyDto extends DecimalDto {
  readonly c: CurrencyCode;
}

interface QuoteSnapshotDto {
  readonly rate: DecimalDto;
  readonly price: MoneyDto;
  readonly observedAt: string;
}

interface OrderDto {
  readonly id: string;
  readonly reference: string;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly instrumentName: string;
  readonly currency: CurrencyCode;
  readonly side: OrderSide;
  readonly quantity: DecimalDto;
  readonly state: OrderState;
  readonly submittedAt: string;
  readonly indicativeQuote: QuoteSnapshotDto;
  readonly executionQuote?: QuoteSnapshotDto;
  readonly consideration?: MoneyDto;
  readonly filledAt?: string;
  readonly rejectionReason?: RejectionReason;
  readonly transitions: readonly {
    at: string;
    from: OrderState | null;
    to: OrderState;
    detail: string;
  }[];
}

interface PersistedState {
  readonly version: 1;
  readonly savedAt: string;
  readonly positions: readonly { instrumentId: string; quantity: DecimalDto; averageCost: MoneyDto }[];
  readonly cash: readonly { currency: CurrencyCode; available: MoneyDto }[];
  readonly orders: readonly OrderDto[];
  readonly orderSequence: number;
}

// ---- Codecs ----------------------------------------------------------------

const encodeDecimal = (d: Decimal): DecimalDto => ({ u: d.unscaled.toString(), s: d.scale });
const decodeDecimal = (d: DecimalDto): Decimal => Decimal.ofUnscaled(BigInt(d.u), d.s);

const encodeMoney = (m: Money): MoneyDto => ({ ...encodeDecimal(m.amount), c: m.currency });
const decodeMoney = (m: MoneyDto): Money => Money.from(decodeDecimal(m), m.c, 'HALF_EVEN');

const encodeQuote = (q: QuoteSnapshot): QuoteSnapshotDto => ({
  rate: encodeDecimal(q.rate),
  price: encodeMoney(q.price),
  observedAt: q.observedAt.toISOString(),
});
const decodeQuote = (q: QuoteSnapshotDto): QuoteSnapshot => ({
  rate: decodeDecimal(q.rate),
  price: decodeMoney(q.price),
  observedAt: new Date(q.observedAt),
});

function encodeOrder(order: Order): OrderDto {
  return {
    id: order.id,
    reference: order.reference,
    accountId: order.accountId,
    instrumentId: order.instrumentId,
    symbol: order.symbol,
    instrumentName: order.instrumentName,
    currency: order.currency,
    side: order.side,
    quantity: encodeDecimal(order.quantity),
    state: order.state,
    submittedAt: order.submittedAt.toISOString(),
    indicativeQuote: encodeQuote(order.indicativeQuote),
    ...(order.executionQuote ? { executionQuote: encodeQuote(order.executionQuote) } : {}),
    ...(order.consideration ? { consideration: encodeMoney(order.consideration) } : {}),
    ...(order.filledAt ? { filledAt: order.filledAt.toISOString() } : {}),
    ...(order.rejectionReason ? { rejectionReason: order.rejectionReason } : {}),
    transitions: order.transitions.map((t) => ({
      at: t.at.toISOString(),
      from: t.from,
      to: t.to,
      detail: t.detail,
    })),
  };
}

function decodeOrder(dto: OrderDto): Order {
  const transitions: OrderTransition[] = dto.transitions.map((t) => ({
    at: new Date(t.at),
    from: t.from,
    to: t.to,
    detail: t.detail,
  }));
  return {
    id: dto.id,
    reference: dto.reference,
    accountId: dto.accountId,
    instrumentId: dto.instrumentId,
    symbol: dto.symbol,
    instrumentName: dto.instrumentName,
    currency: dto.currency,
    side: dto.side,
    quantity: decodeDecimal(dto.quantity),
    state: dto.state,
    submittedAt: new Date(dto.submittedAt),
    indicativeQuote: decodeQuote(dto.indicativeQuote),
    executionQuote: dto.executionQuote ? decodeQuote(dto.executionQuote) : undefined,
    consideration: dto.consideration ? decodeMoney(dto.consideration) : undefined,
    filledAt: dto.filledAt ? new Date(dto.filledAt) : undefined,
    rejectionReason: dto.rejectionReason as RejectionReason | undefined,
    transitions,
  };
}

// ---- Store -----------------------------------------------------------------

export interface RestoredPortfolio {
  readonly positions: readonly Omit<Position, 'accountId'>[];
  readonly cash: readonly Omit<CashBalance, 'accountId'>[];
}

@Injectable({ providedIn: 'root' })
export class DemoStore {
  /** Read once at startup; later writes go straight through to storage. */
  private state: PersistedState | null = this.read();

  get available(): boolean {
    return typeof localStorage !== 'undefined';
  }

  /** True when this session resumed a previous one rather than seeding fixtures. */
  readonly resumed = this.state !== null;

  restorePortfolio(): RestoredPortfolio | null {
    if (!this.state) return null;
    return {
      positions: this.state.positions.map((p) => ({
        instrumentId: p.instrumentId,
        quantity: decodeDecimal(p.quantity),
        averageCost: decodeMoney(p.averageCost),
      })),
      cash: this.state.cash.map((c) => ({
        currency: c.currency,
        available: decodeMoney(c.available),
      })),
    };
  }

  restoreOrders(): { orders: readonly Order[]; nextSequence: number } | null {
    if (!this.state) return null;
    return {
      orders: this.state.orders.map(decodeOrder),
      nextSequence: this.state.orderSequence,
    };
  }

  savePortfolio(positions: readonly Position[], cash: readonly CashBalance[]): void {
    this.merge({
      positions: positions.map((p) => ({
        instrumentId: p.instrumentId,
        quantity: encodeDecimal(p.quantity),
        averageCost: encodeMoney(p.averageCost),
      })),
      cash: cash.map((c) => ({ currency: c.currency, available: encodeMoney(c.available) })),
    });
  }

  saveOrders(orders: readonly Order[], nextSequence: number): void {
    this.merge({ orders: orders.map(encodeOrder), orderSequence: nextSequence });
  }

  /** Clears saved state and reloads, so every service re-seeds from fixtures. */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — nothing to clear */
    }
    this.state = null;
    if (typeof location !== 'undefined') location.reload();
  }

  private merge(patch: Partial<PersistedState>): void {
    const next: PersistedState = {
      version: 1,
      savedAt: new Date().toISOString(),
      positions: patch.positions ?? this.state?.positions ?? [],
      cash: patch.cash ?? this.state?.cash ?? [],
      orders: patch.orders ?? this.state?.orders ?? [],
      orderSequence: patch.orderSequence ?? this.state?.orderSequence ?? 1,
    };
    this.state = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded or storage disabled. A demo aid must never break the app,
      // so this degrades to in-memory behaviour rather than throwing.
    }
  }

  private read(): PersistedState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedState;
      // Anything not matching the current shape is discarded, not migrated.
      return parsed?.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }
}
