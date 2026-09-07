/**
 * Order lifecycle types.
 *
 * CLAUDE.md, "Order lifecycle": Submitted, Accepted, Rejected, Filled,
 * Cancelled. Transitions are explicit and validated, an order cannot skip
 * states, and every transition writes an audit event.
 *
 * CLAUDE.md also requires that rejection is "a first-class outcome with a
 * reason code, not an exception" — hence PreTradeOutcome being a discriminated
 * union rather than a thrown error.
 *
 * [US-05][US-06][US-07][US-09][US-14]
 */

import type { Decimal } from '../money/decimal';
import type { Money } from '../money/money';
import type { CurrencyCode } from '../money/currency';

export type OrderSide = 'BUY' | 'SELL';

export type OrderState = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'FILLED' | 'CANCELLED';

/** The only transitions the platform permits. Anything else is a defect. */
export const PERMITTED_TRANSITIONS: Readonly<Record<OrderState, readonly OrderState[]>> = {
  SUBMITTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['FILLED', 'CANCELLED'],
  REJECTED: [],
  FILLED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return PERMITTED_TRANSITIONS[from].includes(to);
}

export function isTerminal(state: OrderState): boolean {
  return PERMITTED_TRANSITIONS[state].length === 0;
}

/** [US-07] Reason codes returned by pre-trade validation. */
export type RejectionReasonCode =
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_HOLDINGS'
  | 'INSTRUMENT_NOT_TRADEABLE'
  | 'MARKET_CLOSED'
  | 'QUANTITY_PRECISION_EXCEEDED'
  | 'FRACTIONAL_NOT_PERMITTED'
  | 'QUANTITY_NOT_POSITIVE'
  | 'NO_QUOTE_AVAILABLE';

export interface RejectionReason {
  readonly code: RejectionReasonCode;
  /** Client-facing explanation. Reason codes are for systems; this is for people. */
  readonly message: string;
}

/**
 * [US-07] Pre-trade validation returns acceptance or rejection. It never throws
 * for a business outcome — a rejected order is a recorded, audited fact.
 */
export type PreTradeOutcome =
  | { readonly kind: 'ACCEPTED' }
  | { readonly kind: 'REJECTED'; readonly reason: RejectionReason };

/** A recorded price observation attached to an order. */
export interface QuoteSnapshot {
  /** The quote as it was published, at the instrument's quoting precision. */
  readonly rate: Decimal;
  /** The same quote as settleable cash, at the currency's minor-unit scale. */
  readonly price: Money;
  /** BR-14 requires the quote's own observation time to be retained, not the time it was used. */
  readonly observedAt: Date;
}

/** [US-09][US-17] One step in the order's life, in order. */
export interface OrderTransition {
  readonly at: Date;
  readonly from: OrderState | null;
  readonly to: OrderState;
  readonly detail: string;
}

export interface Order {
  readonly id: string;
  readonly reference: string;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly instrumentName: string;
  /** Settlement currency of the instrument, for formatting recorded prices. */
  readonly currency: CurrencyCode;
  readonly side: OrderSide;
  readonly quantity: Decimal;
  readonly state: OrderState;
  readonly submittedAt: Date;

  /**
   * [US-16] The quote the client was shown before submitting.
   *
   * CLAUDE.md / Prompt 2: "the quote a client saw and the quote an order filled
   * at are two separate recorded facts". This is the first of the two.
   */
  readonly indicativeQuote: QuoteSnapshot;

  /**
   * [BR-08][BR-14] The quote the order actually executed against, retained with
   * its timestamp. The second of the two facts. Absent until filled.
   */
  readonly executionQuote?: QuoteSnapshot;

  /** Signed cash effect of the fill: negative for a buy, positive for a sell. */
  readonly consideration?: Money;
  readonly filledAt?: Date;
  readonly rejectionReason?: RejectionReason;
  readonly transitions: readonly OrderTransition[];
}

export const ORDER_STATE_LABELS: Readonly<Record<OrderState, string>> = {
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
};

/** Drives the status pill colour. */
export function stateTone(state: OrderState): 'pending' | 'good' | 'bad' | 'muted' {
  switch (state) {
    case 'SUBMITTED':
    case 'ACCEPTED':
      return 'pending';
    case 'FILLED':
      return 'good';
    case 'REJECTED':
      return 'bad';
    case 'CANCELLED':
      return 'muted';
  }
}
