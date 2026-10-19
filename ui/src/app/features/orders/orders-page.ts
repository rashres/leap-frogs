import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import type { Order } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { MarketStore } from '../../core/state/market.store';
import { CopiedOrdersStore } from '../../core/state/copied-orders.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatPrice, formatQty, formatStamp, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

type Filter = 'ALL' | 'PENDING' | 'FILLED' | 'REJECTED' | 'COPIED';

interface Step {
  readonly state: string;
  readonly at: string;
  readonly detail: string;
}

interface Row {
  readonly id: number;
  readonly instrumentId: number;
  readonly symbol: string;
  readonly instrumentName: string;
  readonly side: Order['side'];
  readonly status: Order['status'];
  readonly label: string;
  readonly tone: string;
  readonly submitted: string;
  readonly quantity: string;
  readonly price: string;
  readonly value: string;
  readonly fulfilled: string;
  /** "Market" or "Limit at $180.00". */
  readonly type: string;
  readonly timeInForce: string;
  readonly expires: string;
  /** The lead trader this order was copied from, or null for the account's own orders. */
  readonly copiedFrom: {
    readonly traderId: number;
    readonly name: string;
    readonly handle: string;
    /** Null for a sell placed by the copy's stop-loss. */
    readonly leaderOrderId: number | null;
  } | null;
  readonly steps: readonly Step[];
}

/**
 * Order history for the active account, from GET /api/accounts/{id}/orders.
 * Layout adapted from fe/21-page-mascots (features/orders).
 */
@Component({
  selector: 'leap-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, PageHeader, Icon],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
})
export class OrdersPage {
  protected readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);
  private readonly ordersApi = inject(OrdersService);
  private readonly copied = inject(CopiedOrdersStore);

  readonly filters: readonly Filter[] = ['ALL', 'PENDING', 'FILLED', 'REJECTED', 'COPIED'];
  readonly filterLabels: Record<Filter, string> = {
    ALL: 'All',
    PENDING: 'Pending',
    FILLED: 'Filled',
    REJECTED: 'Rejected',
    COPIED: 'Copy traded',
  };
  readonly filter = signal<Filter>('ALL');
  readonly expanded = signal<number | null>(null);
  /** The order a cancel is in flight for, and the last cancel failure. */
  readonly cancelling = signal<number | null>(null);
  readonly cancelError = signal<string | null>(null);

  private readonly all = computed<Row[]>(() =>
    this.portfolio.orderList().map((o) => {
      const filled = o.status === 'COMPLETE';
      const copy = this.copied.copiedFrom(o.orderId);
      const waiting = o.limitPrice != null ? `until ${o.symbol} reaches ${formatPrice(o.limitPrice)} or better` : 'for the market to open';
      const steps: Step[] = [
        {
          state: 'Submitted',
          at: formatStamp(o.placedTime),
          detail: copy
            ? copy.leaderOrderId != null
              ? `${o.side} ${formatQty(o.quantity)} ${o.symbol} copied from ${copy.traderName}'s order #${copy.leaderOrderId}, scaled to your allocation.`
              : `${o.side} ${formatQty(o.quantity)} ${o.symbol} placed by the stop-loss on your copy of ${copy.traderName}.`
            : `${o.side} ${formatQty(o.quantity)} ${o.symbol} received by POST /api/accounts/${o.accountId}/orders.`,
        },
      ];
      if (filled) {
        // Filled after waiting as Pending. An instant fill is stamped a few microseconds after it was placed.
        const waited = o.fulfilledTime != null && Date.parse(o.fulfilledTime) - Date.parse(o.placedTime) > 1000;
        steps.push({
          state: waited ? 'Pending → Filled' : 'Submitted → Filled',
          at: formatStamp(o.fulfilledTime),
          detail: `Executed at ${formatPrice(o.price)}; cash and holdings updated.`,
        });
      } else if (o.status === 'FAILED') {
        steps.push({
          state: 'Submitted → Rejected',
          at: formatStamp(o.placedTime),
          detail: 'Failed the cash or holdings check. The API returns the reason on the POST response only; it is not stored.',
        });
      } else if (o.status === 'PENDING') {
        steps.push({
          state: 'Pending',
          at: formatStamp(o.placedTime),
          detail: `Waiting ${waiting}. ${o.expiresAt ? `Expires ${formatStamp(o.expiresAt)}.` : 'Open until filled or cancelled.'}`,
        });
      } else if (o.status === 'CANCELLED') {
        steps.push({ state: 'Pending → Cancelled', at: '', detail: 'Cancelled before it filled; nothing was traded.' });
      } else if (o.status === 'EXPIRED') {
        steps.push({
          state: 'Pending → Expired',
          at: formatStamp(o.expiresAt),
          detail: 'A day order that did not fill before its session closed; nothing was traded.',
        });
      }
      return {
        id: o.orderId,
        instrumentId: o.instrumentId,
        symbol: o.symbol,
        instrumentName: this.market.instrument(o.instrumentId)?.name ?? o.symbol,
        side: o.side,
        status: o.status,
        label: ORDER_STATUS_LABELS[o.status],
        tone: statusTone(o.status),
        submitted: formatStamp(o.placedTime),
        quantity: formatQty(o.quantity),
        price: formatPrice(o.price),
        value: formatUsd(o.value),
        fulfilled: o.fulfilledTime ? formatStamp(o.fulfilledTime) : '—',
        type: o.limitPrice != null ? `Limit at ${formatPrice(o.limitPrice)}` : 'Market',
        timeInForce: o.timeInForce === 'GTC' ? "Good 'til cancelled" : 'Day',
        expires: o.expiresAt ? formatStamp(o.expiresAt) : '—',
        copiedFrom: copy ? { traderId: copy.copyTraderId, name: copy.traderName, handle: copy.traderHandle, leaderOrderId: copy.leaderOrderId } : null,
        steps,
      };
    }),
  );

  readonly rows = computed(() => {
    const all = this.all();
    switch (this.filter()) {
      case 'PENDING':
        return all.filter((o) => o.status === 'PENDING');
      case 'FILLED':
        return all.filter((o) => o.status === 'COMPLETE');
      case 'REJECTED':
        return all.filter((o) => o.status === 'FAILED');
      case 'COPIED':
        return all.filter((o) => o.copiedFrom != null);
      default:
        return all;
    }
  });

  readonly counts = computed<Record<Filter, number>>(() => {
    const all = this.all();
    return {
      ALL: all.length,
      PENDING: all.filter((o) => o.status === 'PENDING').length,
      FILLED: all.filter((o) => o.status === 'COMPLETE').length,
      REJECTED: all.filter((o) => o.status === 'FAILED').length,
      COPIED: all.filter((o) => o.copiedFrom != null).length,
    };
  });

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  toggle(orderId: number): void {
    this.expanded.update((current) => (current === orderId ? null : orderId));
  }

  /** Cancels a pending order; the button sits inside the clickable row. */
  cancel(event: Event, orderId: number): void {
    event.stopPropagation();
    const accountId = this.portfolio.account.activeId();
    if (accountId == null || this.cancelling() != null) return;
    this.cancelling.set(orderId);
    this.cancelError.set(null);
    this.ordersApi.cancel(accountId, orderId).subscribe({
      next: () => this.cancelling.set(null),
      error: (error: unknown) => {
        this.cancelling.set(null);
        // 409: it filled or expired a moment ago. Reload so the row shows what happened.
        this.cancelError.set(toApiError(error).message);
        this.ordersApi.notifyChanged();
      },
    });
  }

  /** From the disclosure button, which sits inside the clickable row. */
  toggleFromButton(event: Event, orderId: number): void {
    event.stopPropagation();
    this.toggle(orderId);
  }
}
