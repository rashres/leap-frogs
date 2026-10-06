import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Holding, Instrument, OrderSide } from '../../core/api/models';
import { OrdersService, type PlaceOrderResult } from '../../core/api/orders.service';
import { ToastService } from '../../core/state/toast.service';
import { DateTimePipe, QtyPipe, UsdPipe, formatQty, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { StatusPill } from '../../shared/status-pill';

/**
 * Buy / sell form for one account. Submits POST /api/accounts/{id}/orders and
 * shows every outcome the API can produce: 201 completed, 422 rejected (with
 * the reason), 400 invalid fields, 404 unknown account or instrument.
 */
@Component({
  selector: 'leap-order-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InstrumentLogo, StatusPill, UsdPipe, QtyPipe, DateTimePipe],
  templateUrl: './order-ticket.html',
  styleUrl: './order-ticket.scss',
})
export class OrderTicket {
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly accountId = input.required<number | null>();
  readonly instruments = input.required<Instrument[]>();
  readonly holdings = input<Holding[]>([]);
  readonly cash = input<number | null>(null);
  /** Hide the instrument picker when the ticket is opened for one instrument. */
  readonly lockInstrument = input(false);

  readonly instrumentId = model<number | null>(null);
  readonly side = model<OrderSide>('BUY');

  readonly placed = output<PlaceOrderResult>();

  readonly quantityText = signal('');
  readonly skipBrowserChecks = signal(false);
  readonly submitting = signal(false);
  readonly touched = signal(false);
  readonly result = signal<PlaceOrderResult | null>(null);
  readonly error = signal<ApiError | null>(null);

  readonly selected = computed(() => this.instruments().find((i) => i.instrumentId === this.instrumentId()));

  readonly held = computed(
    () => this.holdings().find((h) => h.instrumentId === this.instrumentId())?.quantity ?? 0,
  );

  readonly quantityError = computed<string | null>(() => {
    const text = this.quantityText().trim();
    if (!text) {
      return 'Enter a quantity.';
    }
    const value = Number(text);
    if (!Number.isFinite(value)) {
      return 'Quantity must be a number.';
    }
    if (value <= 0) {
      return 'Quantity must be greater than 0.';
    }
    if ((text.split('.')[1] ?? '').length > 6) {
      return 'At most 6 decimal places.';
    }
    return null;
  });

  readonly estimate = computed(() => {
    const price = this.selected()?.lastPrice;
    const qty = Number(this.quantityText());
    return price != null && Number.isFinite(qty) && qty > 0 ? price * qty : null;
  });

  readonly canSubmit = computed(
    () =>
      this.accountId() != null &&
      this.instrumentId() != null &&
      !this.submitting() &&
      (this.skipBrowserChecks() || this.quantityError() === null),
  );

  /** Server-side validation message for one field (400 responses). */
  fieldError(field: string): string | null {
    return this.error()?.fieldErrors[field] ?? null;
  }

  chooseInstrument(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.instrumentId.set(value ? Number(value) : null);
    this.clearOutcome();
  }

  setSide(side: OrderSide): void {
    this.side.set(side);
    this.clearOutcome();
  }

  setQuantity(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
    this.clearOutcome();
  }

  useMax(): void {
    this.quantityText.set(String(this.held()));
    this.clearOutcome();
  }

  toggleSkipChecks(event: Event): void {
    this.skipBrowserChecks.set((event.target as HTMLInputElement).checked);
  }

  submit(): void {
    this.touched.set(true);
    const accountId = this.accountId();
    const instrumentId = this.instrumentId();
    if (!this.canSubmit() || accountId == null || instrumentId == null) {
      return;
    }

    this.submitting.set(true);
    this.clearOutcome();
    const text = this.quantityText().trim();
    const parsed = Number(text);
    // With browser checks skipped, send what was typed (blank -> null, "abc" -> "abc") so the API's own validation answers.
    const quantity = (!text ? null : Number.isFinite(parsed) ? parsed : text) as number;

    this.orders.place(accountId, { instrumentId, side: this.side(), quantity }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.result.set(result);
        this.placed.emit(result);
        const o = result.order;
        if (result.kind === 'completed') {
          this.toast.success(`${o.side} ${o.symbol} completed`, `${formatQty(o.quantity)} @ ${formatUsd(o.price)} · order #${o.orderId}`);
          this.quantityText.set('');
          this.touched.set(false);
        } else {
          this.toast.error(`${o.side} ${o.symbol} rejected`, result.reason);
        }
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const apiError = toApiError(error);
        this.error.set(apiError);
        this.toast.error(`Order failed · ${apiError.status || 'network'}`, apiError.message);
      },
    });
  }

  private clearOutcome(): void {
    this.result.set(null);
    this.error.set(null);
  }
}
