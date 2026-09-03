/**
 * Decimal arithmetic tests.
 *
 * CLAUDE.md treats a float anywhere near a price as a defect, so these tests
 * exist to prove the replacement is actually exact — particularly the rounding
 * behaviour on negative values, where truncating bigint division is easy to get
 * subtly wrong.
 *
 * [chore]
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal';

describe('Decimal', () => {
  describe('parsing and formatting', () => {
    it('round-trips a decimal string, preserving trailing zeros', () => {
      expect(Decimal.parse('1234.50').toString()).toBe('1234.50');
      expect(Decimal.parse('-0.001').toString()).toBe('-0.001');
      expect(Decimal.parse('0').toString()).toBe('0');
      expect(Decimal.parse('+42').toString()).toBe('42');
    });

    it('rejects anything that is not a plain decimal', () => {
      expect(() => Decimal.parse('1e5')).toThrow();
      expect(() => Decimal.parse('1,000')).toThrow();
      expect(() => Decimal.parse('abc')).toThrow();
      expect(Decimal.tryParse('nonsense')).toBeNull();
    });

    it('groups thousands and trims trailing zeros on request', () => {
      expect(Decimal.parse('1234567.89').toGroupedString()).toBe('1,234,567.89');
      expect(Decimal.parse('-9876543.21').toGroupedString()).toBe('-9,876,543.21');
      expect(Decimal.parse('1.50000000').toTrimmedString()).toBe('1.5');
      expect(Decimal.parse('7.00').toTrimmedString()).toBe('7');
    });
  });

  describe('exactness', () => {
    it('adds without the float error that motivates this class', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754. Not here.
      const sum = Decimal.parse('0.1').plus(Decimal.parse('0.2'));
      expect(sum.toString()).toBe('0.3');
      expect(sum.equals(Decimal.parse('0.30'))).toBe(true);
    });

    it('holds precision far beyond a double at crypto scale', () => {
      const quantity = Decimal.parse('0.00000001');
      const price = Decimal.parse('94820.12345678');
      expect(quantity.timesExact(price).toString()).toBe('0.0009482012345678');
    });

    it('aligns differing scales when adding and subtracting', () => {
      expect(Decimal.parse('1.5').plus(Decimal.parse('2.25')).toString()).toBe('3.75');
      expect(Decimal.parse('10').minus(Decimal.parse('0.001')).toString()).toBe('9.999');
    });
  });

  describe('rounding', () => {
    it('applies HALF_UP away from zero on both signs', () => {
      expect(Decimal.parse('2.5').rescale(0, 'HALF_UP').toString()).toBe('3');
      expect(Decimal.parse('-2.5').rescale(0, 'HALF_UP').toString()).toBe('-3');
      expect(Decimal.parse('2.4').rescale(0, 'HALF_UP').toString()).toBe('2');
    });

    it("applies HALF_EVEN as bankers' rounding", () => {
      expect(Decimal.parse('2.5').rescale(0, 'HALF_EVEN').toString()).toBe('2');
      expect(Decimal.parse('3.5').rescale(0, 'HALF_EVEN').toString()).toBe('4');
      expect(Decimal.parse('-2.5').rescale(0, 'HALF_EVEN').toString()).toBe('-2');
      expect(Decimal.parse('2.51').rescale(0, 'HALF_EVEN').toString()).toBe('3');
    });

    it('distinguishes DOWN/UP from FLOOR/CEILING on negatives', () => {
      expect(Decimal.parse('-1.7').rescale(0, 'DOWN').toString()).toBe('-1');
      expect(Decimal.parse('-1.2').rescale(0, 'UP').toString()).toBe('-2');
      expect(Decimal.parse('-1.2').rescale(0, 'FLOOR').toString()).toBe('-2');
      expect(Decimal.parse('-1.7').rescale(0, 'CEILING').toString()).toBe('-1');
    });

    it('widens scale without changing value', () => {
      expect(Decimal.parse('1.5').rescale(4, 'HALF_EVEN').toString()).toBe('1.5000');
    });
  });

  describe('precision limits', () => {
    it('detects quantities carrying more precision than a class permits', () => {
      // A whole-share class rejects any fractional part.
      expect(Decimal.parse('10.5').exceedsScale(0)).toBe(true);
      expect(Decimal.parse('10.0').exceedsScale(0)).toBe(false);
      // Crypto permits 8dp but not 9.
      expect(Decimal.parse('0.123456789').exceedsScale(8)).toBe(true);
      expect(Decimal.parse('0.12345678').exceedsScale(8)).toBe(false);
    });
  });

  describe('multiplication and division', () => {
    it('multiplies to an explicit target scale', () => {
      const price = Decimal.parse('229.45');
      const quantity = Decimal.parse('3');
      expect(price.times(quantity, 2, 'HALF_UP').toString()).toBe('688.35');
    });

    it('rounds a fractional consideration at the target scale', () => {
      // 0.425 BTC at 94820.00 = 40298.50 exactly.
      expect(Decimal.parse('94820.00').times(Decimal.parse('0.425'), 2, 'HALF_UP').toString()).toBe('40298.50');
    });

    it('divides with an explicit scale and rounding mode', () => {
      expect(Decimal.parse('10').divide(Decimal.parse('3'), 4, 'HALF_EVEN').toString()).toBe('3.3333');
      expect(Decimal.parse('1').divide(Decimal.parse('8'), 4, 'HALF_EVEN').toString()).toBe('0.1250');
      expect(Decimal.parse('-10').divide(Decimal.parse('3'), 2, 'HALF_UP').toString()).toBe('-3.33');
    });

    it('refuses division by zero', () => {
      expect(() => Decimal.parse('1').divide(Decimal.zero(2), 2, 'HALF_UP')).toThrow();
    });
  });

  describe('comparison', () => {
    it('compares across differing scales', () => {
      expect(Decimal.parse('1.50').equals(Decimal.parse('1.5'))).toBe(true);
      expect(Decimal.parse('1.5').greaterThan(Decimal.parse('1.49'))).toBe(true);
      expect(Decimal.parse('-1').lessThan(Decimal.zero(0))).toBe(true);
      expect(Decimal.parse('0.00').isZero()).toBe(true);
    });
  });
});
