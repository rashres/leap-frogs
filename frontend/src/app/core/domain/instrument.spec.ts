/**
 * Instrument class policy tests.
 *
 * CLAUDE.md: the five classes "do not share rules". These tests pin the
 * differences that pre-trade validation depends on — trading hours in each
 * exchange's own timezone, and quantity precision per class.
 *
 * [US-07][US-15]
 */

import { describe, expect, it } from 'vitest';
import { INSTRUMENT_CLASS_POLICIES, policyFor } from './instrument';

// 27 Aug 2026 is a Thursday; 29 Aug a Saturday; 30 Aug a Sunday.
const thursday = (utc: string) => new Date(`2026-08-27T${utc}Z`);
const saturday = (utc: string) => new Date(`2026-08-29T${utc}Z`);
const sunday = (utc: string) => new Date(`2026-08-30T${utc}Z`);

describe('instrument class policies', () => {
  describe('trading hours', () => {
    it('opens the LSE 08:00–16:30 London time on weekdays', () => {
      const lse = policyFor('EQUITIES_UK');
      // August is BST (UTC+1), so 09:00Z is 10:00 in London.
      expect(lse.isMarketOpen(thursday('09:00:00'))).toBe(true);
      expect(lse.isMarketOpen(thursday('06:00:00'))).toBe(false); // 07:00 London, pre-open
      expect(lse.isMarketOpen(thursday('16:00:00'))).toBe(false); // 17:00 London, closed
      expect(lse.isMarketOpen(saturday('09:00:00'))).toBe(false);
    });

    it('opens US equities 09:30–16:00 New York time on weekdays', () => {
      const us = policyFor('EQUITIES_US');
      // August is EDT (UTC-4), so 14:30Z is 10:30 in New York.
      expect(us.isMarketOpen(thursday('14:30:00'))).toBe(true);
      expect(us.isMarketOpen(thursday('12:00:00'))).toBe(false); // 08:00 NY, pre-open
      expect(us.isMarketOpen(thursday('20:30:00'))).toBe(false); // 16:30 NY, closed
      expect(us.isMarketOpen(sunday('14:30:00'))).toBe(false);
    });

    it('opens Indian equities 09:15–15:30 Mumbai time on weekdays', () => {
      const india = policyFor('EQUITIES_INDIA');
      // IST is UTC+5:30 year round, so 05:00Z is 10:30 in Mumbai.
      expect(india.isMarketOpen(thursday('05:00:00'))).toBe(true);
      expect(india.isMarketOpen(thursday('03:00:00'))).toBe(false); // 08:30 IST, pre-open
      expect(india.isMarketOpen(thursday('11:00:00'))).toBe(false); // 16:30 IST, closed
    });

    it('runs FX continuously from Sunday 22:00 to Friday 22:00 UTC', () => {
      const fx = policyFor('FX');
      expect(fx.isMarketOpen(thursday('03:00:00'))).toBe(true); // mid-week, small hours
      expect(fx.isMarketOpen(saturday('12:00:00'))).toBe(false); // weekend
      expect(fx.isMarketOpen(sunday('20:00:00'))).toBe(false); // before the Sunday open
      expect(fx.isMarketOpen(sunday('23:00:00'))).toBe(true); // after it
    });

    it('never closes crypto', () => {
      const crypto = policyFor('CRYPTO');
      expect(crypto.isMarketOpen(saturday('03:00:00'))).toBe(true);
      expect(crypto.isMarketOpen(sunday('12:00:00'))).toBe(true);
      expect(crypto.isMarketOpen(thursday('23:59:00'))).toBe(true);
    });
  });

  describe('quantity rules', () => {
    it('permits fractional units only where the class allows them', () => {
      expect(policyFor('EQUITIES_UK').fractionalAllowed).toBe(false);
      expect(policyFor('EQUITIES_INDIA').fractionalAllowed).toBe(false);
      expect(policyFor('EQUITIES_US').fractionalAllowed).toBe(true);
      expect(policyFor('CRYPTO').fractionalAllowed).toBe(true);
    });

    it('sets quantity precision per class', () => {
      expect(policyFor('EQUITIES_UK').quantityScale).toBe(0);
      expect(policyFor('CRYPTO').quantityScale).toBe(8);
      expect(policyFor('FX').priceScale).toBe(5);
    });

    it('does not assume a single settlement currency', () => {
      const currencies = Object.values(INSTRUMENT_CLASS_POLICIES).map((p) => p.settlementCurrency);
      expect(new Set(currencies).size).toBeGreaterThan(1);
      expect(policyFor('EQUITIES_UK').settlementCurrency).toBe('GBP');
      expect(policyFor('EQUITIES_INDIA').settlementCurrency).toBe('INR');
    });
  });
});
