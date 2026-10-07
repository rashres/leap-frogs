import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { AccountsService } from '../api/accounts.service';
import { createLoader } from '../api/loader';
import type { Order } from '../api/models';
import { OrdersService } from '../api/orders.service';
import { ActiveAccountService } from './active-account.service';
import { MarketStore } from './market.store';

export interface Position {
  readonly instrumentId: number;
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly quantity: number;
  readonly lastPrice: number | null;
  /** Weighted average price of the completed buys still held; null with no buy history. */
  readonly averageCost: number | null;
  readonly marketValue: number | null;
  readonly bookCost: number | null;
  readonly unrealisedPnl: number | null;
  readonly unrealisedPnlPercent: number | null;
}

interface Basis {
  quantity: number;
  cost: number;
}

/**
 * Average cost per instrument from completed orders, oldest first. A sell
 * releases shares at the running average, so it lowers cost without changing
 * the average of what is left.
 */
export function costBasis(orders: readonly Order[]): Map<number, Basis> {
  const basis = new Map<number, Basis>();
  const completed = orders
    .filter((o) => o.status === 'COMPLETE')
    .sort((a, b) => Date.parse(a.placedTime) - Date.parse(b.placedTime));
  for (const order of completed) {
    const b = basis.get(order.instrumentId) ?? { quantity: 0, cost: 0 };
    if (order.side === 'BUY') {
      b.quantity += order.quantity;
      b.cost += order.quantity * order.price;
    } else if (b.quantity > 0) {
      const sold = Math.min(order.quantity, b.quantity);
      b.cost -= (b.cost / b.quantity) * sold;
      b.quantity -= sold;
    }
    basis.set(order.instrumentId, b);
  }
  return basis;
}

/**
 * The active account's cash, holdings and orders, valued at each instrument's
 * lastPrice. Reloads when the account changes or an order is placed.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioStore {
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  private readonly market = inject(MarketStore);
  readonly account = inject(ActiveAccountService);

  readonly holdings = createLoader(() => this.accountsApi.holdings(this.account.activeId()!));
  readonly orders = createLoader(() => this.ordersApi.list(this.account.activeId()!));

  readonly cash = computed(() => this.account.active()?.cashBalance ?? null);

  /** Newest first, as the API returns them. */
  readonly orderList = computed(() => this.orders.data() ?? []);

  readonly positions = computed<Position[]>(() => {
    const basis = costBasis(this.orderList());
    const instruments = this.market.byId();
    return (this.holdings.data() ?? []).map((h) => {
      const lastPrice = instruments.get(h.instrumentId)?.lastPrice ?? null;
      const b = basis.get(h.instrumentId);
      const averageCost = b && b.quantity > 0 ? b.cost / b.quantity : null;
      const marketValue = lastPrice != null ? h.quantity * lastPrice : null;
      const bookCost = averageCost != null ? h.quantity * averageCost : null;
      const unrealisedPnl = marketValue != null && bookCost != null ? marketValue - bookCost : null;
      return {
        instrumentId: h.instrumentId,
        symbol: h.symbol,
        name: h.instrumentName,
        exchange: h.exchange,
        quantity: h.quantity,
        lastPrice,
        averageCost,
        marketValue,
        bookCost,
        unrealisedPnl,
        unrealisedPnlPercent: unrealisedPnl != null && bookCost ? (unrealisedPnl / bookCost) * 100 : null,
      };
    });
  });

  readonly marketValue = computed(() => this.positions().reduce((sum, p) => sum + (p.marketValue ?? 0), 0));
  readonly unpricedCount = computed(() => this.positions().filter((p) => p.lastPrice == null).length);
  readonly totalValue = computed(() => {
    const cash = this.cash();
    return cash == null ? null : cash + this.marketValue();
  });

  private readonly withPnl = computed(() => this.positions().filter((p) => p.unrealisedPnl != null));
  readonly hasPnl = computed(() => this.withPnl().length > 0);
  readonly totalUnrealisedPnl = computed(() => this.withPnl().reduce((sum, p) => sum + p.unrealisedPnl!, 0));
  readonly totalReturnPercent = computed(() => {
    const book = this.withPnl().reduce((sum, p) => sum + p.bookCost!, 0);
    return book > 0 ? (this.totalUnrealisedPnl() / book) * 100 : 0;
  });

  constructor() {
    effect(() => {
      const id = this.account.activeId();
      this.ordersApi.changes();
      if (id != null) {
        untracked(() => {
          this.holdings.reload();
          this.orders.reload();
        });
      }
    });
  }

  position(instrumentId: number): Position | undefined {
    return this.positions().find((p) => p.instrumentId === instrumentId);
  }

  heldQuantity(instrumentId: number): number {
    return this.holdings.data()?.find((h) => h.instrumentId === instrumentId)?.quantity ?? 0;
  }

  ordersFor(instrumentId: number): Order[] {
    return this.orderList().filter((o) => o.instrumentId === instrumentId);
  }
}
