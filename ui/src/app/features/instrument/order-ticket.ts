import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Instrument, Order, OrderSide, OrderType, TimeInForce } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { marketFor } from '../../core/markets/sessions';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatSignedUsd, formatPrice, formatStamp, formatTime, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { LivePrice } from '../../shared/live-price';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';

type Step = 'edit' | 'review';

/** The API stores quantities and prices as NUMERIC(18,6). */
const QTY_SCALE = 6;

/** A positive number with at most 6 decimal places, or null. */
function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d*\.?\d+$/.test(trimmed) || (trimmed.split('.')[1] ?? '').length > QTY_SCALE) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

interface Placed {
  readonly order: Order;
  readonly confirmedPrice: number | null;
  readonly reason: string | null;
}

/**
 * Buy / sell ticket with a review step, adapted from the team's Angular app
 * (fe/21-page-mascots, features/instrument/order-ticket). Confirming sends
 * POST /api/accounts/{id}/orders; the API decides the fill price and the outcome.
 * A market order fills now while the market is open; a limit order fills only
 * at its limit or better. Anything that cannot fill yet waits as Pending.
 */
@Component({
  selector: 'leap-order-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LivePrice, KeyValuePipe, Icon],
  templateUrl: './order-ticket.html',
  styleUrl: './order-ticket.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class OrderTicket {
  private readonly orders = inject(OrdersService);
  private readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);
  protected readonly account = inject(ActiveAccountService);

  readonly instrument = input.required<Instrument>();
  /** Side to preselect, e.g. from a Buy / Sell shortcut elsewhere. The user can still switch. */
  readonly initialSide = input<OrderSide>('BUY');

  readonly side = signal<OrderSide>('BUY');
  readonly orderType = signal<OrderType>('MARKET');
  /** Day is the default: an unfilled order does not linger past its session. */
  readonly timeInForce = signal<TimeInForce>('DAY');
  readonly quantityText = signal('');
  readonly limitText = signal('');
  readonly step = signal<Step>('edit');
  readonly submitting = signal(false);
  readonly placed = signal<Placed | null>(null);
  readonly error = signal<ApiError | null>(null);

  /** The price as it stood when review was entered. */
  private readonly reviewedPrice = signal<number | null>(null);

  readonly price = computed(() => this.instrument().lastPrice ?? null);

  readonly quantity = computed(() => parseDecimal(this.quantityText()));
  readonly quantityInvalid = computed(() => this.quantityText().trim() !== '' && this.quantity() === null);

  readonly isLimit = computed(() => this.orderType() === 'LIMIT');
  readonly limitPrice = computed(() => (this.isLimit() ? parseDecimal(this.limitText()) : null));
  readonly limitInvalid = computed(() => this.isLimit() && this.limitText().trim() !== '' && this.limitPrice() === null);

  /** The market this instrument trades on, and whether it is open now (the API checks the same hours). */
  private readonly session = computed(() => marketFor(this.instrument().exchange));
  readonly marketOpen = computed(() => this.session()?.isOpen(this.market.now()) ?? true);
  readonly sessionHours = computed(() => this.session()?.sessionLabel ?? '');

  /** Whether the order would fill the moment it arrives; otherwise it waits as Pending. */
  readonly fillsNow = computed(() => {
    if (!this.marketOpen()) return false;
    const price = this.price();
    const limit = this.limitPrice();
    if (!this.isLimit() || price == null || limit == null) return true;
    return this.side() === 'BUY' ? price <= limit : price >= limit;
  });

  /** Price per share the cost is worked out at: the market if it fills now, the limit if it waits for one. */
  private readonly costPrice = computed(() => (this.fillsNow() ? this.price() : (this.limitPrice() ?? this.price())));

  /** A waiting limit order is bounded by its limit: a buy costs at most that, a sell raises at least that. */
  readonly totalQualifier = computed(() => {
    if (this.fillsNow() || !this.isLimit()) return 'Estimated';
    return this.side() === 'BUY' ? 'At most' : 'At least';
  });

  readonly consideration = computed(() => {
    const quantity = this.quantity();
    const price = this.costPrice();
    return quantity && price != null ? quantity * price : null;
  });

  /** Cash and shares not already held back by other pending orders. */
  readonly cash = computed(() => this.portfolio.availableCash() ?? 0);
  readonly held = computed(() => this.portfolio.availableQuantity(this.instrument().instrumentId));
  readonly reservedCash = computed(() => this.portfolio.reservedCash());

  /** Mirrors the API's own checks so a client sees a rejection coming; the API still decides. */
  readonly rejection = computed<string | null>(() => {
    const quantity = this.quantity();
    if (!quantity) return null;
    if (this.price() == null) return 'This instrument has no price yet, so the API cannot take an order.';
    if (this.side() === 'BUY' && this.consideration()! > this.cash()) {
      return `Insufficient cash: needs ${formatUsd(this.consideration())}, ${formatUsd(this.cash())} available.`;
    }
    if (this.side() === 'SELL' && quantity > this.held()) {
      return `Insufficient shares: selling ${formatQty(quantity)}, ${formatQty(this.held())} available.`;
    }
    return null;
  });

  readonly canSubmit = computed(
    () =>
      (this.quantity() ?? 0) > 0 &&
      (!this.isLimit() || this.limitPrice() != null) &&
      this.account.activeId() != null &&
      !this.submitting(),
  );

  readonly maxQuantity = computed(() => {
    if (this.side() === 'SELL') return Math.max(this.held(), 0);
    const price = this.costPrice();
    if (!price) return 0;
    const factor = 10 ** QTY_SCALE;
    return Math.max(Math.floor((this.cash() / price) * factor) / factor, 0);
  });

  /** What happens on confirm, in a sentence. */
  readonly outcome = computed(() => {
    if (this.fillsNow()) return null;
    const symbol = this.instrument().symbol;
    const expiry = this.timeInForce() === 'DAY' ? 'If it has not filled by the close, it expires.' : 'It stays open until it fills or you cancel it.';
    if (!this.marketOpen()) {
      const limit = this.limitPrice();
      const when = limit != null ? `once the market opens and ${symbol} is ${this.side() === 'BUY' ? 'at or below' : 'at or above'} ${formatPrice(limit)}` : 'when the market opens';
      return `The market is closed (${this.sessionHours()}). This order will wait as Pending and fill ${when}. ${expiry}`;
    }
    return `${symbol} is ${this.side() === 'BUY' ? 'above' : 'below'} your limit, so this order will wait as Pending until it reaches ${formatPrice(this.limitPrice())}. ${expiry}`;
  });

  readonly priceText = computed(() => formatPrice(this.price()));
  readonly considerationText = computed(() => formatUsd(this.consideration()));
  readonly cashText = computed(() => formatUsd(this.cash()));
  readonly heldText = computed(() => formatQty(this.held()));
  readonly reservedCashText = computed(() => formatUsd(this.reservedCash()));

  readonly reviewed = computed(() => {
    const price = this.reviewedPrice();
    const quantity = this.quantity();
    if (!quantity) return null;
    const limit = this.limitPrice();
    const at = this.fillsNow() ? price : (limit ?? price);
    return {
      quantity: formatQty(quantity),
      priceText: formatPrice(price),
      type: this.isLimit() ? `Limit at ${formatPrice(limit)}` : 'Market',
      timeInForce: this.timeInForce() === 'DAY' ? 'Day' : "Good 'til cancelled",
      consideration: at != null ? formatUsd(at * quantity) : '—',
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
    const outcome = filled
      ? {
          state: 'Filled',
          at: formatTime(order.fulfilledTime),
          detail: `Executed at ${formatPrice(order.price)} for ${formatUsd(order.value)}.`,
        }
      : order.status === 'PENDING'
        ? {
            state: 'Pending',
            at: formatTime(order.placedTime),
            detail:
              (order.limitPrice != null ? `Waiting to fill at ${formatPrice(order.limitPrice)} or better. ` : 'Waiting for the market to open. ') +
              (order.expiresAt ? `Expires ${formatStamp(order.expiresAt)}.` : 'Open until filled or cancelled.') +
              ' Cancel it from the Orders page.',
          }
        : { state: 'Rejected', at: formatTime(order.placedTime), detail: reason ?? 'Rejected by the API.' };
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
        outcome,
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

  constructor() {
    effect(() => {
      const side = this.initialSide();
      untracked(() => this.setSide(side));
    });
  }

  setSide(side: OrderSide): void {
    this.side.set(side);
    this.resetFlow();
  }

  setOrderType(type: OrderType): void {
    this.orderType.set(type);
    // Good 'til cancelled only makes sense with a limit; a market order fills at the next open anyway.
    if (type === 'MARKET') this.timeInForce.set('DAY');
    else if (!this.limitText() && this.price() != null) this.limitText.set(String(this.price()));
    this.resetFlow();
  }

  setTimeInForce(tif: TimeInForce): void {
    this.timeInForce.set(tif);
    this.resetFlow();
  }

  onQuantity(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
    this.resetFlow();
  }

  onLimit(event: Event): void {
    this.limitText.set((event.target as HTMLInputElement).value);
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
    const limit = this.isLimit();
    this.orders
      .place(accountId, {
        instrumentId: this.instrument().instrumentId,
        side: this.side(),
        quantity,
        orderType: this.orderType(),
        limitPrice: limit ? this.limitPrice() : null,
        timeInForce: limit ? this.timeInForce() : 'DAY',
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.placed.set({
            order: result.order,
            confirmedPrice,
            reason: result.kind === 'rejected' ? result.reason : null,
          });
          if (result.kind !== 'rejected') this.quantityText.set('');
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
