/**
 * Pre-trade validation.
 *
 * CLAUDE.md, "Domain invariants": pre-trade validation runs before an order is
 * ever accepted — sufficient cash for a buy, sufficient holdings for a sell,
 * instrument tradeable, market open, quantity within precision limits for that
 * instrument class. "Rejection is a first-class outcome with a reason code, not
 * an exception."
 *
 * Accordingly this returns a PreTradeOutcome union and throws nothing for a
 * business outcome. It is a distinct component, not logic inlined into an order
 * handler, so the same rules can be exercised directly by tests.
 *
 * Cash is checked against the balance in the INSTRUMENT'S settlement currency
 * only, per the locked cash model: per-currency balances, no auto-FX. A client
 * with ample GBP and no USD cannot buy a US equity.
 *
 * [US-07]
 */

import { Injectable, inject } from '@angular/core';
import { Decimal } from '../money/decimal';
import type { Money } from '../money/money';
import { isMarketOpenFor, policyFor, type Instrument } from '../domain/instrument';
import type { OrderSide, PreTradeOutcome, RejectionReasonCode } from '../domain/order';
import { PortfolioService } from './portfolio.service';

export interface PreTradeRequest {
  readonly instrument: Instrument;
  readonly side: OrderSide;
  readonly quantity: Decimal;
  /** Consideration computed from the indicative quote. Null when no quote exists. */
  readonly consideration: Money | null;
  readonly at?: Date;
}

const ACCEPTED: PreTradeOutcome = { kind: 'ACCEPTED' };

function reject(code: RejectionReasonCode, message: string): PreTradeOutcome {
  return { kind: 'REJECTED', reason: { code, message } };
}

@Injectable({ providedIn: 'root' })
export class PreTradeValidator {
  private readonly portfolio = inject(PortfolioService);

  validate(request: PreTradeRequest): PreTradeOutcome {
    const { instrument, side, quantity, consideration } = request;
    const at = request.at ?? new Date();
    const policy = policyFor(instrument.classCode);

    if (!quantity.isPositive()) {
      return reject('QUANTITY_NOT_POSITIVE', 'Enter a quantity greater than zero.');
    }

    if (!instrument.tradeable) {
      return reject(
        'INSTRUMENT_NOT_TRADEABLE',
        instrument.suspensionNote ?? `${instrument.symbol} is not currently tradeable.`,
      );
    }

    if (!isMarketOpenFor(instrument, at)) {
      return reject('MARKET_CLOSED', `${policy.label} is closed. Trading hours are ${policy.sessionLabel}.`);
    }

    // A fractional quantity on a class that only deals whole units.
    if (!policy.fractionalAllowed && quantity.exceedsScale(0)) {
      return reject(
        'FRACTIONAL_NOT_PERMITTED',
        `${instrument.symbol} trades in whole units only on ${policy.label}.`,
      );
    }

    // More decimal places than the class permits, e.g. 9dp on an 8dp crypto.
    if (quantity.exceedsScale(policy.quantityScale)) {
      return reject(
        'QUANTITY_PRECISION_EXCEEDED',
        policy.quantityScale === 0
          ? `${instrument.symbol} accepts whole quantities only.`
          : `${instrument.symbol} accepts at most ${policy.quantityScale} decimal places.`,
      );
    }

    if (!consideration) {
      return reject('NO_QUOTE_AVAILABLE', `No current price for ${instrument.symbol}. Try again shortly.`);
    }

    if (side === 'BUY') {
      const available = this.portfolio.cashFor(consideration.currency);
      if (available.lessThan(consideration)) {
        return reject(
          'INSUFFICIENT_CASH',
          `Needs ${consideration.format()} of ${consideration.currency}; ${available.format()} available. ` +
            `Balances are held per currency and are not converted automatically.`,
        );
      }
    } else {
      const held = this.portfolio.heldQuantity(instrument.id);
      if (held.lessThan(quantity)) {
        return reject(
          'INSUFFICIENT_HOLDINGS',
          `Selling ${quantity.toTrimmedString()} but only ${held.toTrimmedString()} ${instrument.symbol} held.`,
        );
      }
    }

    return ACCEPTED;
  }
}
