/**
 * A Decimal amount bound to a currency.
 *
 * Cross-currency arithmetic throws rather than silently converting. Under the
 * platform's locked cash model (per-currency balances, no auto-FX) there is no
 * implicit rate anywhere in the system, so an accidental GBP + USD is always a
 * defect and should fail loudly.
 *
 * [chore] — see docs/open-questions.md for the cash-model decision record.
 */

import { Decimal, type RoundingMode } from './decimal';
import { type CurrencyCode, scaleOf, symbolOf } from './currency';

export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: CurrencyCode,
  ) {}

  /** Builds from a decimal string, restated at the currency's own scale. */
  static of(text: string, currency: CurrencyCode): Money {
    return new Money(Decimal.parse(text).rescale(scaleOf(currency), 'HALF_EVEN'), currency);
  }

  static from(amount: Decimal, currency: CurrencyCode, mode: RoundingMode = 'HALF_EVEN'): Money {
    return new Money(amount.rescale(scaleOf(currency), mode), currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(Decimal.zero(scaleOf(currency)), currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /**
   * Unit price × quantity. Rounding is explicit because a fractional crypto
   * quantity at an 8dp price routinely produces more digits than the settlement
   * currency can hold.
   */
  timesQuantity(quantity: Decimal, mode: RoundingMode): Money {
    return new Money(this.amount.times(quantity, scaleOf(this.currency), mode), this.currency);
  }

  negated(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    return this.amount.compareTo(other.amount);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compareTo(other) >= 0;
  }
  lessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }
  isZero(): boolean {
    return this.amount.isZero();
  }
  isNegative(): boolean {
    return this.amount.isNegative();
  }

  /** "£1,234.50" — sign leads the symbol, as every broker renders it. */
  format(): string {
    const negative = this.amount.isNegative();
    const body = this.amount.abs().toGroupedString();
    return `${negative ? '-' : ''}${symbolOf(this.currency)}${body}`;
  }

  /** "£1,234.50 GBP" — for contexts holding several currencies at once. */
  formatWithCode(): string {
    return `${this.format()} ${this.currency}`;
  }

  /** "+£12.40" / "-£12.40" — for deltas, where the sign is the message. */
  formatSigned(): string {
    const sign = this.amount.isNegative() ? '-' : '+';
    return `${sign}${symbolOf(this.currency)}${this.amount.abs().toGroupedString()}`;
  }

  toString(): string {
    return `${this.amount.toString()} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new TypeError(
        `Cross-currency arithmetic: ${this.currency} and ${other.currency}. ` +
          'This platform holds per-currency balances and never auto-converts.',
      );
    }
  }
}

/** Percentage change between two same-currency amounts, to 2dp. */
export function percentChange(from: Money, to: Money): Decimal {
  return percentChangeOf(from.amount, to.amount);
}

/**
 * Percentage change between two raw decimals, to 2dp.
 *
 * Needed for quoted rates, which carry finer precision than their currency's
 * minor unit. Computing an FX move from currency-scaled Money would round
 * 1.34215 to 1.34 first and report every intraday move as 0.00%.
 */
export function percentChangeOf(from: Decimal, to: Decimal): Decimal {
  if (from.isZero()) return Decimal.zero(2);
  const delta = to.minus(from);
  return delta.divide(from.abs(), 6, 'HALF_EVEN').times(Decimal.ofInteger(100), 2, 'HALF_EVEN');
}

/**
 * Formats a quoted RATE at its own precision, not the currency's.
 *
 * A price and a cash amount are different things. Cash is denominated in a
 * currency's minor unit — USD to 2dp, always. A quote is denominated in
 * whatever precision its market quotes to: GBP/USD trades to 5dp, USD/INR to
 * 4dp. `Money` deliberately clamps to the currency scale because a balance may
 * not hold fractions of a penny; rates must not be clamped the same way.
 */
export function formatRate(rate: Decimal, currency: CurrencyCode): string {
  const negative = rate.isNegative();
  return `${negative ? '-' : ''}${symbolOf(currency)}${rate.abs().toGroupedString()}`;
}

/** As formatRate, but always leading with an explicit sign. For deltas. */
export function formatRateSigned(rate: Decimal, currency: CurrencyCode): string {
  return `${rate.isNegative() ? '-' : '+'}${symbolOf(currency)}${rate.abs().toGroupedString()}`;
}
