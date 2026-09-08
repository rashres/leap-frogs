/**
 * Money tests.
 *
 * The cross-currency test is the important one: under the locked cash model
 * there is no implicit conversion anywhere in the platform, so GBP + USD must
 * fail loudly rather than produce a plausible wrong number.
 *
 * [US-13]
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal';
import { Money, formatRate, formatRateSigned, percentChange, percentChangeOf } from './money';

describe('Money', () => {
  it('holds each currency at its own scale', () => {
    expect(Money.of('10', 'GBP').amount.toString()).toBe('10.00');
    // JPY has no minor unit, which is why scale cannot be hardcoded to 2.
    expect(Money.of('10', 'JPY').amount.toString()).toBe('10');
    expect(Money.of('0.5', 'BTC').amount.toString()).toBe('0.50000000');
  });

  it('refuses cross-currency arithmetic', () => {
    const pounds = Money.of('100', 'GBP');
    const dollars = Money.of('100', 'USD');
    expect(() => pounds.plus(dollars)).toThrow(/Cross-currency/);
    expect(() => pounds.minus(dollars)).toThrow(/Cross-currency/);
    expect(() => pounds.compareTo(dollars)).toThrow(/Cross-currency/);
  });

  it('adds and subtracts within a currency', () => {
    expect(Money.of('18450.00', 'GBP').minus(Money.of('450.55', 'GBP')).format()).toBe('£17,999.45');
    expect(Money.of('0.01', 'USD').plus(Money.of('0.02', 'USD')).format()).toBe('$0.03');
  });

  it('prices a quantity at the currency scale with explicit rounding', () => {
    const price = Money.of('229.45', 'USD');
    // 7 shares at 229.45 = 1606.15
    expect(price.timesQuantity(Decimal.parse('7'), 'HALF_UP').format()).toBe('$1,606.15');
    // A fractional crypto quantity produces more digits than USD can hold.
    const btc = Money.of('94820.00', 'USD');
    expect(btc.timesQuantity(Decimal.parse('0.00012345'), 'HALF_UP').format()).toBe('$11.71');
  });

  it('formats negatives with the sign ahead of the symbol', () => {
    expect(Money.of('-1234.5', 'GBP').format()).toBe('-£1,234.50');
    expect(Money.of('-20', 'USD').formatSigned()).toBe('-$20.00');
    expect(Money.of('20', 'USD').formatSigned()).toBe('+$20.00');
    expect(Money.of('415600', 'INR').format()).toBe('₹415,600.00');
  });

  it('keeps a quoted rate at its own precision, not the currency scale', () => {
    // Regression: an FX pair quoted to 5dp must not be clamped to USD's 2dp.
    // Rendering GBP/USD as "$1.34" loses the entire tradeable part of the price.
    const gbpusd = Decimal.parse('1.34215');
    expect(formatRate(gbpusd, 'USD')).toBe('$1.34215');
    expect(Money.of('1.34215', 'USD').format()).toBe('$1.34'); // cash still clamps, correctly
    expect(formatRate(Decimal.parse('88.4250'), 'INR')).toBe('₹88.4250');
    expect(formatRateSigned(Decimal.parse('-0.00042'), 'USD')).toBe('-$0.00042');
    expect(formatRateSigned(Decimal.parse('0.00042'), 'USD')).toBe('+$0.00042');
  });

  it('measures an FX move that currency-scaled money would round to zero', () => {
    const open = Decimal.parse('1.34215');
    const now = Decimal.parse('1.34402');
    // Real move is +0.14%. Rounded to 2dp both are 1.34, reporting 0.00%.
    expect(percentChangeOf(open, now).toString()).toBe('0.14');
    expect(percentChange(Money.of('1.34215', 'USD'), Money.of('1.34402', 'USD')).toString()).toBe('0.00');
  });

  it('computes percentage change to two places', () => {
    expect(percentChange(Money.of('100', 'GBP'), Money.of('110', 'GBP')).toString()).toBe('10.00');
    expect(percentChange(Money.of('100', 'GBP'), Money.of('95.5', 'GBP')).toString()).toBe('-4.50');
    // A zero base has no meaningful percentage; it must not divide by zero.
    expect(percentChange(Money.zero('GBP'), Money.of('10', 'GBP')).toString()).toBe('0.00');
  });
});
