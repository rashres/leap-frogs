/**
 * Order history.
 *
 * US-14 asks for order history in chronological order. Each row expands to its
 * full transition timeline — the same sequence of state changes the backend
 * writes as audit events, which is what US-20's lifecycle reconstruction will
 * ultimately replay. Both recorded price facts are shown: the indicative quote
 * the client saw (US-16) and the quote the order filled against (BR-08/BR-14).
 *
 * [US-14][US-09]
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/data/order.service';
import {
  ORDER_STATE_LABELS,
  stateTone,
  type Order,
  type OrderState,
  type QuoteSnapshot,
} from '../../core/domain/order';
import { formatRate } from '../../core/money/money';
import type { CurrencyCode } from '../../core/money/currency';
import { InstrumentLogo } from '../../shared/instrument-logo';

type Filter = 'ALL' | 'WORKING' | 'FILLED' | 'REJECTED';

@Component({
  selector: 'leap-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
})
export class OrdersPage {
  private readonly orderService = inject(OrderService);

  readonly filters: readonly Filter[] = ['ALL', 'WORKING', 'FILLED', 'REJECTED'];
  readonly filter = signal<Filter>('ALL');
  readonly expanded = signal<string | null>(null);

  /** Newest first — the chronology US-14 asks for, most recent at the top. */
  readonly rows = computed<readonly Order[]>(() => {
    const all = this.orderService.orders();
    switch (this.filter()) {
      case 'WORKING':
        return all.filter((o) => o.state === 'SUBMITTED' || o.state === 'ACCEPTED');
      case 'FILLED':
        return all.filter((o) => o.state === 'FILLED');
      case 'REJECTED':
        return all.filter((o) => o.state === 'REJECTED');
      default:
        return all;
    }
  });

  readonly counts = computed(() => {
    const all = this.orderService.orders();
    return {
      ALL: all.length,
      WORKING: all.filter((o) => o.state === 'SUBMITTED' || o.state === 'ACCEPTED').length,
      FILLED: all.filter((o) => o.state === 'FILLED').length,
      REJECTED: all.filter((o) => o.state === 'REJECTED').length,
    } as Record<Filter, number>;
  });

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  toggle(orderId: string): void {
    this.expanded.update((current) => (current === orderId ? null : orderId));
  }

  /** From the disclosure button, which sits inside the clickable row. */
  toggleFromButton(event: Event, orderId: string): void {
    event.stopPropagation();
    this.toggle(orderId);
  }

  cancel(event: Event, orderId: string): void {
    event.stopPropagation();
    this.orderService.cancel(orderId);
  }

  /**
   * Formats a recorded quote at the instrument's quoting precision.
   *
   * Orders here span currencies and instrument classes, so the currency comes
   * from the order itself rather than any page-level context.
   */
  rateText(snapshot: QuoteSnapshot, currency: CurrencyCode): string {
    return formatRate(snapshot.rate, currency);
  }

  label(state: OrderState): string {
    return ORDER_STATE_LABELS[state];
  }

  tone(state: OrderState): string {
    return stateTone(state);
  }

  timestamp(at: Date): string {
    return at.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
