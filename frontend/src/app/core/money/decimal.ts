/**
 * Arbitrary-precision signed decimal backed by a bigint of unscaled units.
 *
 * CLAUDE.md, "Domain invariants": money is never a floating point number, and a
 * `double` anywhere near a price, quantity or balance is a defect. In TypeScript
 * `number` IS an IEEE-754 double, so `number` is banned from every value that
 * represents money or quantity. This type is the frontend counterpart of
 * BigDecimal on the write side.
 *
 * Every operation that can lose precision demands an explicit target scale and an
 * explicit RoundingMode at the call site. There is deliberately no default.
 *
 * [chore] — supporting infrastructure, no story of its own.
 */

export type RoundingMode =
  | 'HALF_UP'
  | 'HALF_EVEN'
  | 'DOWN' // toward zero
  | 'UP' // away from zero
  | 'FLOOR' // toward -infinity
  | 'CEILING'; // toward +infinity

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** 10^n as a bigint, memoised. */
const POW10_CACHE: bigint[] = [1n];
function pow10(n: number): bigint {
  if (n < 0) throw new RangeError(`Negative exponent: ${n}`);
  for (let i = POW10_CACHE.length; i <= n; i++) {
    POW10_CACHE[i] = POW10_CACHE[i - 1] * 10n;
  }
  return POW10_CACHE[n];
}

/**
 * Rounds a truncated quotient given its remainder.
 * bigint division truncates toward zero, so `remainder` carries the sign of the
 * dividend and the negative cases have to be handled explicitly.
 */
function round(quotient: bigint, remainder: bigint, divisor: bigint, mode: RoundingMode): bigint {
  if (remainder === 0n) return quotient;

  const negative = remainder < 0n;
  const absRemainder = negative ? -remainder : remainder;
  const step = negative ? -1n : 1n;
  const doubled = absRemainder * 2n;

  switch (mode) {
    case 'DOWN':
      return quotient;
    case 'UP':
      return quotient + step;
    case 'FLOOR':
      return negative ? quotient - 1n : quotient;
    case 'CEILING':
      return negative ? quotient : quotient + 1n;
    case 'HALF_UP':
      return doubled >= divisor ? quotient + step : quotient;
    case 'HALF_EVEN':
      if (doubled > divisor) return quotient + step;
      if (doubled < divisor) return quotient;
      return quotient % 2n === 0n ? quotient : quotient + step;
  }
}

export class Decimal {
  private constructor(
    /** Value as an integer, i.e. the real value multiplied by 10^scale. */
    readonly unscaled: bigint,
    /** Number of digits after the decimal point. Always >= 0. */
    readonly scale: number,
  ) {}

  /**
   * Parses a decimal from its string form. Strings only — accepting a `number`
   * here would reintroduce float error at the boundary, which is the whole thing
   * this class exists to prevent.
   */
  static parse(text: string): Decimal {
    const match = DECIMAL_PATTERN.exec(text.trim());
    if (!match) throw new TypeError(`Not a valid decimal: "${text}"`);
    const [, sign, whole, fraction = ''] = match;
    const digits = `${whole}${fraction}`;
    const unscaled = BigInt(digits) * (sign === '-' ? -1n : 1n);
    return new Decimal(unscaled, fraction.length);
  }

  /** Parses, returning null instead of throwing. For user input. */
  static tryParse(text: string): Decimal | null {
    if (!DECIMAL_PATTERN.test(text.trim())) return null;
    return Decimal.parse(text);
  }

  static ofUnscaled(unscaled: bigint, scale: number): Decimal {
    return new Decimal(unscaled, scale);
  }

  static zero(scale = 0): Decimal {
    return new Decimal(0n, scale);
  }

  /** Integer count — safe because it never came from a fractional value. */
  static ofInteger(value: number | bigint): Decimal {
    return new Decimal(BigInt(value), 0);
  }

  /** Restates this value at `targetScale`, rounding away any lost digits. */
  rescale(targetScale: number, mode: RoundingMode): Decimal {
    if (targetScale === this.scale) return this;
    if (targetScale > this.scale) {
      return new Decimal(this.unscaled * pow10(targetScale - this.scale), targetScale);
    }
    const divisor = pow10(this.scale - targetScale);
    const quotient = this.unscaled / divisor;
    const remainder = this.unscaled % divisor;
    return new Decimal(round(quotient, remainder, divisor, mode), targetScale);
  }

  /** True when the value carries more precision than `scale` allows. */
  exceedsScale(scale: number): boolean {
    if (this.scale <= scale) return false;
    return this.unscaled % pow10(this.scale - scale) !== 0n;
  }

  plus(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale);
    return new Decimal(this.at(scale) + other.at(scale), scale);
  }

  minus(other: Decimal): Decimal {
    const scale = Math.max(this.scale, other.scale);
    return new Decimal(this.at(scale) - other.at(scale), scale);
  }

  /** Exact product. Scale is the sum of the operand scales; nothing is lost. */
  timesExact(other: Decimal): Decimal {
    return new Decimal(this.unscaled * other.unscaled, this.scale + other.scale);
  }

  /** Product restated at `targetScale`. Rounding is explicit by design. */
  times(other: Decimal, targetScale: number, mode: RoundingMode): Decimal {
    return this.timesExact(other).rescale(targetScale, mode);
  }

  divide(other: Decimal, targetScale: number, mode: RoundingMode): Decimal {
    if (other.isZero()) throw new RangeError('Division by zero');
    // Scale the numerator up so the quotient carries one extra digit to round on.
    const shift = targetScale + other.scale - this.scale + 1;
    const numerator = shift >= 0 ? this.unscaled * pow10(shift) : this.unscaled / pow10(-shift);
    const raw = numerator / other.unscaled;
    const remainder = numerator % other.unscaled;
    // `raw` sits at targetScale+1; nudge the last digit so rounding sees a true remainder.
    const carried = remainder === 0n ? raw : raw + (raw < 0n ? -1n : 1n);
    return new Decimal(carried, targetScale + 1).rescale(targetScale, mode);
  }

  negated(): Decimal {
    return new Decimal(-this.unscaled, this.scale);
  }

  abs(): Decimal {
    return this.unscaled < 0n ? this.negated() : this;
  }

  /** -1, 0 or 1. */
  compareTo(other: Decimal): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale);
    const a = this.at(scale);
    const b = other.at(scale);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  equals(other: Decimal): boolean {
    return this.compareTo(other) === 0;
  }
  lessThan(other: Decimal): boolean {
    return this.compareTo(other) < 0;
  }
  greaterThan(other: Decimal): boolean {
    return this.compareTo(other) > 0;
  }
  greaterThanOrEqual(other: Decimal): boolean {
    return this.compareTo(other) >= 0;
  }
  isZero(): boolean {
    return this.unscaled === 0n;
  }
  isNegative(): boolean {
    return this.unscaled < 0n;
  }
  isPositive(): boolean {
    return this.unscaled > 0n;
  }

  /** Plain string form, e.g. "-1234.50". Always shows exactly `scale` digits. */
  toString(): string {
    const negative = this.unscaled < 0n;
    const digits = (negative ? -this.unscaled : this.unscaled).toString().padStart(this.scale + 1, '0');
    const whole = digits.slice(0, digits.length - this.scale);
    const fraction = this.scale === 0 ? '' : `.${digits.slice(digits.length - this.scale)}`;
    return `${negative ? '-' : ''}${whole}${fraction}`;
  }

  /** Thousands-separated string, e.g. "-1,234.50". */
  toGroupedString(): string {
    const raw = this.toString();
    const negative = raw.startsWith('-');
    const unsigned = negative ? raw.slice(1) : raw;
    const [whole, fraction] = unsigned.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
  }

  /** Drops trailing fractional zeros, e.g. 1.5000 -> "1.5". Display only. */
  toTrimmedString(): string {
    const raw = this.toString();
    if (!raw.includes('.')) return raw;
    return raw.replace(/\.?0+$/, '');
  }

  /**
   * Lossy conversion to a float.
   *
   * Permitted for ONE purpose: computing pixel coordinates for charts. A chart
   * axis is geometry, not money, and SVG needs floats regardless. Never feed the
   * result back into a balance, a price, or anything a client is shown as a
   * figure — go through Decimal for that. The name is deliberately obnoxious.
   */
  unsafeToNumberForChartGeometry(): number {
    return Number(this.unscaled) / Number(pow10(this.scale));
  }

  /** This value's unscaled units restated at `scale`. */
  private at(scale: number): bigint {
    return scale === this.scale ? this.unscaled : this.unscaled * pow10(scale - this.scale);
  }
}

export function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}

export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}
