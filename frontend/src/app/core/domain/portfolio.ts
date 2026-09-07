/**
 * Holdings and cash.
 *
 * CashBalance is keyed by account AND currency — the platform holds a set of
 * balances per account, never a single number. This follows the locked
 * multi-currency decision recorded in docs/open-questions.md: per-currency
 * balances with no automatic FX conversion at trade time.
 *
 * [US-12][US-13]
 */

import type { Decimal } from '../money/decimal';
import type { Money } from '../money/money';
import type { CurrencyCode } from '../money/currency';

/** [US-12] A holding, keyed by account and instrument. */
export interface Position {
  readonly accountId: string;
  readonly instrumentId: string;
  readonly quantity: Decimal;
  /** Weighted average price paid per unit, in the instrument's settlement currency. */
  readonly averageCost: Money;
}

/** [US-13] A cash balance, keyed by account and currency. */
export interface CashBalance {
  readonly accountId: string;
  readonly currency: CurrencyCode;
  readonly available: Money;
}

/** A position joined to live pricing, ready to render. */
export interface HoldingView {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly name: string;
  readonly quantity: Decimal;
  readonly averageCost: Money;
  readonly lastPrice: Money;
  readonly marketValue: Money;
  readonly bookCost: Money;
  /** marketValue - bookCost, in the instrument's settlement currency. */
  readonly unrealisedPnl: Money;
  readonly unrealisedPnlPercent: Decimal;
  readonly dayChangePercent: Decimal;
}
