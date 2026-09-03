/**
 * Order ticket, with a review step before anything is sent.
 *
 * WHY THE REVIEW STEP EXISTS. No user story asks for it. CLAUDE.md opens by
 * saying the firm's control today is "a human standing behind every trade who
 * catches mistakes before settlement", and that this judgement has to live in
 * the system instead. A market order that fires on a single click removes that
 * check rather than relocating it. The review panel restates what is about to
 * happen — side, quantity, price, total, settlement currency, and the
 * validation result — and requires a second, deliberate confirmation.
 * Recorded in docs/open-questions.md OQ-13 as an addition, not a requirement.
 *
 * The reviewed quote is FROZEN on entering review. That is deliberate: the
 * price a client agreed to is the one they were looking at, so it is the one
 * recorded as the indicative quote. Execution still reads the latest quote at
 * fill time (BR-08), and any drift between the two is shown afterwards.
 *
 * Validation runs on every keystroke as a preview, and again authoritatively
 * inside OrderService.place(). A previewed rejection does not disable the
 * button: CLAUDE.md requires rejection to be a recorded, audited outcome with a
 * reason code, so an order a client insists on is submitted and rejected on the
 * record rather than silently blocked in the UI.
 *
 * [US-05][US-06][US-07][US-16]
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Decimal } from '../../core/money/decimal';
import { Money, formatRate, formatRateSigned } from '../../core/money/money';
import { policyFor, type Instrument } from '../../core/domain/instrument';
import {
  ORDER_STATE_LABELS,
  stateTone,
  type OrderSide,
  type QuoteSnapshot,
} from '../../core/domain/order';
import { MarketDataService } from '../../core/data/market-data.service';
import { OrderService } from '../../core/data/order.service';
import { PortfolioService } from '../../core/data/portfolio.service';
import { LivePrice } from '../../shared/live-price';

type Step = 'edit' | 'review';

@Component({
  selector: 'leap-order-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LivePrice],
  templateUrl: './order-ticket.html',
  styleUrl: './order-ticket.scss',
  host: {
    // Escape backs out of review without sending anything.
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class OrderTicket {
  private readonly market = inject(MarketDataService);
  private readonly orders = inject(OrderService);
  private readonly portfolio = inject(PortfolioService);

  readonly instrument = input.required<Instrument>();

  readonly side = signal<OrderSide>('BUY');
  readonly quantityText = signal('');
  readonly step = signal<Step>('edit');

  /** The quote as it stood when review was entered. Frozen on purpose. */
  private readonly reviewedQuote = signal<QuoteSnapshot | null>(null);
  private readonly placedId = signal<string | null>(null);

  readonly policy = computed(() => policyFor(this.instrument().classCode));

  /** [US-16] The live indicative price, refreshed on every tick. */
  readonly quote = computed(() => this.market.latestQuote(this.instrument().id));

  readonly quantity = computed<Decimal | null>(() => {
    const text = this.quantityText().trim();
    if (!text) return null;
    return Decimal.tryParse(text);
  });

  readonly consideration = computed<Money | null>(() => {
    const quantity = this.quantity();
    if (!quantity || !quantity.isPositive()) return null;
    return this.orders.considerationFor(this.quote().price, quantity);
  });

  /** [US-07] Live validation preview against the current indicative price. */
  readonly outcome = computed(() => {
    const quantity = this.quantity();
    if (!quantity) return null;
    return this.orders.preview({
      instrument: this.instrument(),
      side: this.side(),
      quantity,
      price: this.quote().price,
    });
  });

  readonly rejection = computed(() => {
    const outcome = this.outcome();
    return outcome?.kind === 'REJECTED' ? outcome.reason : null;
  });

  readonly quantityInvalid = computed(() => this.quantityText().trim() !== '' && this.quantity() === null);

  readonly canSubmit = computed(() => {
    const quantity = this.quantity();
    return quantity !== null && quantity.isPositive();
  });

  /** Buying power in the instrument's settlement currency — never converted. */
  readonly availableCash = computed(() => this.portfolio.cashFor(this.instrument().currency));
  readonly heldQuantity = computed(() => this.portfolio.heldQuantity(this.instrument().id));

  readonly maxQuantity = computed(() =>
    this.side() === 'BUY'
      ? this.orders.maxBuyQuantity(this.instrument(), this.quote().price)
      : this.heldQuantity(),
  );

  // ---- Review step ---------------------------------------------------------

  /** The frozen figures a client is being asked to confirm. */
  readonly reviewed = computed(() => {
    const snapshot = this.reviewedQuote();
    const quantity = this.quantity();
    if (!snapshot || !quantity) return null;
    return {
      quantity,
      rateText: formatRate(snapshot.rate, this.instrument().currency),
      consideration: this.orders.considerationFor(snapshot.price, quantity),
    };
  });

  /**
   * How far the live price has moved since review was entered.
   *
   * Shown because the fill will use the live price, not the reviewed one — the
   * client should be able to see that gap opening before they confirm.
   */
  readonly drift = computed(() => {
    const snapshot = this.reviewedQuote();
    if (!snapshot || this.step() !== 'review') return null;
    const delta = this.quote().rate.minus(snapshot.rate);
    if (delta.isZero()) return null;
    return { text: formatRateSigned(delta, this.instrument().currency), negative: delta.isNegative() };
  });

  // ---- Placed order --------------------------------------------------------

  readonly placed = computed(() => {
    const id = this.placedId();
    return id ? (this.orders.orders().find((order) => order.id === id) ?? null) : null;
  });

  /** Slippage between the price shown at submission and the price it filled at. */
  readonly slippage = computed(() => {
    const order = this.placed();
    if (!order?.executionQuote) return null;
    const delta = order.executionQuote.rate.minus(order.indicativeQuote.rate);
    if (delta.isZero()) return null;
    return { text: formatRateSigned(delta, this.instrument().currency), negative: delta.isNegative() };
  });

  // ---- Actions -------------------------------------------------------------

  setSide(side: OrderSide): void {
    this.side.set(side);
    this.resetFlow();
  }

  onQuantity(event: Event): void {
    this.quantityText.set((event.target as HTMLInputElement).value);
    this.resetFlow();
  }

  useMax(): void {
    this.quantityText.set(this.maxQuantity().toTrimmedString());
    this.resetFlow();
  }

  /** Freezes the current quote and moves to the confirmation step. */
  review(): void {
    if (!this.canSubmit()) return;
    const shown = this.quote();
    this.reviewedQuote.set({ rate: shown.rate, price: shown.price, observedAt: shown.observedAt });
    this.step.set('review');
  }

  back(): void {
    this.step.set('edit');
    this.reviewedQuote.set(null);
  }

  onEscape(): void {
    if (this.step() === 'review') this.back();
  }

  /** [US-05][US-06] Sends the order the client just confirmed. */
  confirm(): void {
    const quantity = this.quantity();
    const snapshot = this.reviewedQuote();
    if (!quantity || !quantity.isPositive() || !snapshot) return;

    const order = this.orders.place({
      instrument: this.instrument(),
      side: this.side(),
      quantity,
      // The reviewed quote is what the client saw and agreed to, so it is what
      // gets recorded as the indicative quote (BR-14).
      indicativeQuote: snapshot,
    });

    this.placedId.set(order.id);
    this.quantityText.set('');
    this.step.set('edit');
    this.reviewedQuote.set(null);
  }

  dismiss(): void {
    this.placedId.set(null);
  }

  // ---- Display helpers -----------------------------------------------------

  rateText(snapshot: QuoteSnapshot): string {
    return formatRate(snapshot.rate, this.instrument().currency);
  }

  stateLabel(state: keyof typeof ORDER_STATE_LABELS): string {
    return ORDER_STATE_LABELS[state];
  }

  stateTone(state: Parameters<typeof stateTone>[0]): string {
    return stateTone(state);
  }

  private resetFlow(): void {
    this.placedId.set(null);
    if (this.step() === 'review') this.back();
  }
}
