import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Instrument, Order, OrderSide } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatSignedUsd, formatPrice, formatTime, formatUsd } from '../../shared/format';
import { LivePrice } from '../../shared/live-price';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';

type Step = 'edit' | 'review';

/** The API stores quantities as NUMERIC(18,6). */
const QTY_SCALE = 6;

interface Placed {
  readonly order: Order;
  readonly confirmedPrice: number | null;
  readonly reason: string | null;
}

/**
 * Buy / sell ticket with a review step, adapted from the team's Angular app
 * (fe/21-page-mascots, features/instrument/order-ticket). Confirming sends
 * POST /api/accounts/{id}/orders; the API decides the fill price and the outcome.
 */
@Component({
  selector: 'leap-order-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LivePrice, KeyValuePipe],
  templateUrl: './order-ticket.html',
  styleUrl: './order-ticket.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class OrderTicket {
  private readonly orders = inject(OrdersService);
  private readonly portfolio = inject(PortfolioStore);
  protected readonly account = inject(ActiveAccountService);

  readonly instrument = input.required<Instrument>();

  readonly side = signal<OrderSide>('BUY');
  readonly quantityText = signal('');
  readonly step = signal<Step>('edit');
  readonly submitting = signal(false);
  readonly placed = signal<Placed | null>(null);
  readonly error = signal<ApiError | null>(null);

  /** The price as it stood when review was entered. */
  private readonly reviewedPrice = signal<number | null>(null);

  readonly price = computed(() => this.instrument().lastPrice ?? null);

  readonly quantity = computed<number | null>(() => {
    const text = this.quantityText().trim();
    if (!/^\d*\.?\d+$/.test(text) || (text.split('.')[1] ?? '').length > QTY_SCALE) return null;
    return Number(text);
  });

  readonly quantityInvalid = computed(() => this.quantityText().trim() !== '' && this.quantity() === null);

  readonly consideration = computed(() => {
    const quantity = this.quantity();
    const price = this.price();
    return quantity && price != null ? quantity * price : null;
  });

  readonly cash = computed(() => this.portfolio.cash() ?? 0);
  readonly held = computed(() => this.portfolio.heldQuantity(this.instrument().instrumentId));

  /** Mirrors the API's own checks so a client sees a rejection coming; the API still decides. */
  readonly rejection = computed<string | null>(() => {
    const quantity = this.quantity();
    if (!quantity) return null;
    if (this.price() == null) return 'This instrument has no price yet, so the API cannot fill an order.';
    if (this.side() === 'BUY' && this.consideration()! > this.cash()) {
      return `Insufficient cash: needs ${formatUsd(this.consideration())}, ${formatUsd(this.cash())} available.`;
    }
    if (this.side() === 'SELL' && quantity > this.held()) {
      return `Insufficient shares: selling ${formatQty(quantity)}, ${formatQty(this.held())} held.`;
    }
    return null;
  });

  readonly canSubmit = computed(() => (this.quantity() ?? 0) > 0 && this.account.activeId() != null && !this.submitting());

  readonly maxQuantity = computed(() => {
    if (this.side() === 'SELL') return this.held();
    const price = this.price();
    if (!price) return 0;
    const factor = 10 ** QTY_SCALE;
    return Math.floor((this.cash() / price) * factor) / factor;
  });

  readonly priceText = computed(() => formatPrice(this.price()));
  readonly considerationText = computed(() => formatUsd(this.consideration()));
  readonly cashText = computed(() => formatUsd(this.cash()));
  readonly heldText = computed(() => formatQty(this.held()));

  readonly reviewed = computed(() => {
    const price = this.reviewedPrice();
    const quantity = this.quantity();
    if (!quantity) return null;
    return {
      quantity: formatQty(quantity),
      priceText: formatPrice(price),
      consideration: price != null ? formatUsd(price * quantity) : '—',
    };
  });

  /** Price movement between entering review and now. */
  readonly drift = computed(() => {
    const reviewed = this.reviewedPrice();
    const now = this.price();
    if (this.step() !== 'review' || reviewed == null || now == null || reviewed === now) return null;
    return { text: formatSignedUsd(now - reviewed), negative: now < reviewed };
  });

  readonly placedView = computed(() => {
    const placed = this.placed();
    if (!placed) return null;
    const { order, confirmedPrice, reason } = placed;
    const filled = order.status === 'COMPLETE';
    const slip = filled && confirmedPrice != null && order.price !== confirmedPrice ? order.price - confirmedPrice : null;
    return {
      ref: `#${order.orderId}`,
      label: ORDER_STATUS_LABELS[order.status],
      tone: statusTone(order.status),
      steps: [
        {
          state: 'Submitted',
          at: formatTime(order.placedTime),
          detail: `${order.side} ${formatQty(order.quantity)} ${order.symbol} sent to the API.`,
        },
        filled
          ? {
              state: 'Filled',
              at: formatTime(order.fulfilledTime),
              detail: `Executed at ${formatPrice(order.price)} for ${formatUsd(order.value)}.`,
            }
          : { state: 'Rejected', at: formatTime(order.placedTime), detail: reason ?? 'Rejected by the API.' },
      ],
      quotes: filled
        ? {
            confirmed: formatPrice(confirmedPrice),
            filled: formatPrice(order.price),
            slippage: slip != null ? { text: formatSignedUsd(slip), negative: slip < 0 } : null,
          }
        : null,
    };
  });

  setSide(side: OrderSide): void {
    this.side.set(side);
    this.resetFlow();
  }

  onQuantity(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
    this.resetFlow();
  }

  useMax(): void {
    this.quantityText.set(String(this.maxQuantity()));
    this.resetFlow();
  }

  review(): void {
    if (!this.canSubmit()) return;
    this.reviewedPrice.set(this.price());
    this.step.set('review');
  }

  back(): void {
    this.step.set('edit');
    this.reviewedPrice.set(null);
  }

  onEscape(): void {
    if (this.step() === 'review') this.back();
  }

  confirm(): void {
    const quantity = this.quantity();
    const accountId = this.account.activeId();
    if (!quantity || accountId == null || this.submitting()) return;

    const confirmedPrice = this.reviewedPrice();
    this.submitting.set(true);
    this.error.set(null);
    this.orders
      .place(accountId, { instrumentId: this.instrument().instrumentId, side: this.side(), quantity })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.placed.set({
            order: result.order,
            confirmedPrice,
            reason: result.kind === 'rejected' ? result.reason : null,
          });
          if (result.kind === 'completed') this.quantityText.set('');
          this.back();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.error.set(toApiError(error));
          this.back();
        },
      });
  }

  dismiss(): void {
    this.placed.set(null);
    this.error.set(null);
  }

  private resetFlow(): void {
    this.placed.set(null);
    this.error.set(null);
    if (this.step() === 'review') this.back();
  }
}
