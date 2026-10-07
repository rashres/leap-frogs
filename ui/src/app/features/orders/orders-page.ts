import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Order } from '../../core/api/models';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatStamp, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { PageMascot } from '../../shared/page-mascot';

type Filter = 'ALL' | 'FILLED' | 'REJECTED';

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
  readonly steps: readonly Step[];
}

/**
 * Order history for the active account, from GET /api/accounts/{id}/orders.
 * Layout adapted from fe/21-page-mascots (features/orders).
 */
@Component({
  selector: 'leap-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, PageMascot],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
})
export class OrdersPage {
  protected readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);

  readonly filters: readonly Filter[] = ['ALL', 'FILLED', 'REJECTED'];
  readonly filter = signal<Filter>('ALL');
  readonly expanded = signal<number | null>(null);

  private readonly all = computed<Row[]>(() =>
    this.portfolio.orderList().map((o) => {
      const filled = o.status === 'COMPLETE';
      const steps: Step[] = [
        {
          state: 'Submitted',
          at: formatStamp(o.placedTime),
          detail: `${o.side} ${formatQty(o.quantity)} ${o.symbol} received by POST /api/accounts/${o.accountId}/orders.`,
        },
      ];
      if (filled) {
        steps.push({
          state: 'Submitted → Filled',
          at: formatStamp(o.fulfilledTime),
          detail: `Executed at ${formatUsd(o.price)}; cash and holdings updated.`,
        });
      } else if (o.status === 'FAILED') {
        steps.push({
          state: 'Submitted → Rejected',
          at: formatStamp(o.placedTime),
          detail: 'Failed validation. The API returns the reason on the POST response only; it is not stored.',
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
        price: formatUsd(o.price),
        value: formatUsd(o.value),
        fulfilled: o.fulfilledTime ? formatStamp(o.fulfilledTime) : '—',
        steps,
      };
    }),
  );

  readonly rows = computed(() => {
    const all = this.all();
    switch (this.filter()) {
      case 'FILLED':
        return all.filter((o) => o.status === 'COMPLETE');
      case 'REJECTED':
        return all.filter((o) => o.status === 'FAILED');
      default:
        return all;
    }
  });

  readonly counts = computed<Record<Filter, number>>(() => {
    const all = this.all();
    return {
      ALL: all.length,
      FILLED: all.filter((o) => o.status === 'COMPLETE').length,
      REJECTED: all.filter((o) => o.status === 'FAILED').length,
    };
  });

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  toggle(orderId: number): void {
    this.expanded.update((current) => (current === orderId ? null : orderId));
  }

  /** From the disclosure button, which sits inside the clickable row. */
  toggleFromButton(event: Event, orderId: number): void {
    event.stopPropagation();
    this.toggle(orderId);
  }
}
