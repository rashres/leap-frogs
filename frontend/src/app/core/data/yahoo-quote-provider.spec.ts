/**
 * Yahoo adapter tests.
 *
 * All parsing is exercised against canned payloads — no network, so these are
 * as deterministic as every other test in the suite.
 *
 * The GBp cases are the important ones. The LSE quotes in pence, and treating
 * a pence figure as pounds overstates every UK holding, balance and P/L by a
 * factor of a hundred. That is a silent, plausible-looking corruption, which is
 * exactly the kind this suite exists to catch.
 *
 * [US-15]
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '../money/decimal';
import { FIXTURE_INSTRUMENTS, type FixtureInstrument } from './fixtures';
import {
  YAHOO_RANGES,
  YAHOO_SYMBOLS,
  decimalFromJson,
  parseHistory,
  parseQuotes,
  toSettlementRate,
} from './yahoo-quote-provider';

const instrument = (id: string): FixtureInstrument =>
  FIXTURE_INSTRUMENTS.find((i) => i.id === id)!;

describe('Yahoo adapter', () => {
  describe('symbol mapping', () => {
    it('maps every fixture instrument to a venue symbol', () => {
      for (const i of FIXTURE_INSTRUMENTS) {
        expect(YAHOO_SYMBOLS[i.id], `missing mapping for ${i.id}`).toBeDefined();
      }
    });

    it('uses the right venue suffix per instrument class', () => {
      expect(YAHOO_SYMBOLS['us-aapl'].symbol).toBe('AAPL');
      expect(YAHOO_SYMBOLS['uk-shel'].symbol).toBe('SHEL.L');
      expect(YAHOO_SYMBOLS['in-tcs'].symbol).toBe('TCS.NS');
      expect(YAHOO_SYMBOLS['fx-gbpusd'].symbol).toBe('GBPUSD=X');
      expect(YAHOO_SYMBOLS['crypto-btc'].symbol).toBe('BTC-USD');
    });

    it('declares London as quoting in pence', () => {
      expect(YAHOO_SYMBOLS['uk-shel'].quotedIn).toBe('GBp');
      expect(YAHOO_SYMBOLS['uk-hsba'].quotedIn).toBe('GBp');
      expect(YAHOO_SYMBOLS['uk-vod'].quotedIn).toBe('GBp');
      // Everything else quotes in its settlement currency.
      expect(YAHOO_SYMBOLS['us-aapl'].quotedIn).toBe('USD');
      expect(YAHOO_SYMBOLS['in-tcs'].quotedIn).toBe('INR');
    });

    it('maps every chart range to a backend range code', () => {
      for (const range of Object.keys(YAHOO_RANGES) as (keyof typeof YAHOO_RANGES)[]) {
        expect(YAHOO_RANGES[range]).toBeTruthy();
      }
      expect(YAHOO_RANGES['1D']).toBe('1D');
    });
  });

  describe('pence conversion', () => {
    it('converts a GBp quote to pounds', () => {
      // 3344.5p is £33.445, NOT £3,344.50.
      const raw = Decimal.parse('3344.5');
      expect(toSettlementRate(raw, 'GBp', 'GBP', 2).toString()).toBe('33.44');
      expect(toSettlementRate(raw, 'GBp', 'GBP', 4).toString()).toBe('33.4450');
    });

    it('converts a sub-pound line at its finer scale', () => {
      // VOD at 118.45p is £1.1845.
      expect(toSettlementRate(Decimal.parse('118.45'), 'GBp', 'GBP', 4).toString()).toBe('1.1845');
    });

    it('passes through a quote already in its settlement currency', () => {
      expect(toSettlementRate(Decimal.parse('316.85'), 'USD', 'USD', 2).toString()).toBe('316.85');
    });

    it('refuses a currency that does not match settlement', () => {
      // Silently accepting this is how a 100x error reaches a client's balance.
      expect(() => toSettlementRate(Decimal.parse('100'), 'USD', 'GBP', 2)).toThrow(/does not match/);
      expect(() => toSettlementRate(Decimal.parse('100'), 'GBp', 'USD', 2)).toThrow(/cannot settle/);
    });
  });

  describe('number conversion', () => {
    it('converts JSON floats without going through arithmetic on a double', () => {
      expect(decimalFromJson(318.075, 4).toString()).toBe('318.0750');
      expect(decimalFromJson(3333, 2).toString()).toBe('3333.00');
      expect(decimalFromJson(1.34215, 5).toString()).toBe('1.34215');
    });

    it('handles a value that stringifies to exponential form', () => {
      expect(decimalFromJson(1e-7, 8).toString()).toBe('0.00000010');
    });
  });

  describe('parseQuotes', () => {
    const payload = [
      { symbol: 'AAPL', price: 317.39, previousClose: 319.7, currency: 'USD' },
      { symbol: 'SHEL.L', price: 3344.5, previousClose: 3311.0, currency: 'GBp' },
    ];

    it('reads the backend-reported price as the current rate', () => {
      const quotes = parseQuotes(payload, [instrument('us-aapl')]);
      expect(quotes).toHaveLength(1);
      expect(quotes[0].rate.toString()).toBe('317.39');
      expect(quotes[0].previousClose.toString()).toBe('319.70');
      expect(quotes[0].currency).toBe('USD');
    });

    it('converts a London line out of pence', () => {
      const quotes = parseQuotes(payload, [instrument('uk-shel')]);
      expect(quotes[0].currency).toBe('GBP');
      // 3344.5p -> £33.44, and emphatically not £3,344.50.
      expect(quotes[0].rate.toString()).toBe('33.44');
      expect(quotes[0].previousClose.toString()).toBe('33.11');
    });

    it('skips instruments the payload does not carry', () => {
      expect(parseQuotes(payload, [instrument('crypto-btc')])).toHaveLength(0);
    });

    it('skips an entry with no usable price rather than inventing one', () => {
      const empty = [{ symbol: 'AAPL', previousClose: 319.7 }];
      expect(parseQuotes(empty, [instrument('us-aapl')])).toHaveLength(0);
    });
  });

  describe('parseHistory', () => {
    it('builds a series and drops entries missing a close or timestamp', () => {
      const payload = {
        currency: 'USD',
        points: [
          { timestamp: 1788183000, close: 318.075 },
          { timestamp: 1788183300 },
          { timestamp: 1788183600, close: 317.39 },
        ],
      };
      const points = parseHistory(payload, instrument('us-aapl'));
      expect(points).toHaveLength(2);
      expect(points[0].price.toString()).toBe('318.08');
      expect(points[1].price.toString()).toBe('317.39');
      expect(points[0].at.getTime()).toBe(1788183000 * 1000);
    });

    it('converts a GBp series to pounds', () => {
      const payload = {
        currency: 'GBp',
        points: [
          { timestamp: 1, close: 3333.5 },
          { timestamp: 2, close: 3344.5 },
        ],
      };
      const points = parseHistory(payload, instrument('uk-shel'));
      expect(points.map((p) => p.price.toString())).toEqual(['33.34', '33.44']);
    });

    it('refuses a payload whose currency contradicts the symbol map', () => {
      // If Yahoo ever switched SHEL.L to pounds, silently continuing would divide
      // by 100 again and understate the holding by the same factor.
      const payload = { currency: 'GBP', points: [{ timestamp: 1, close: 33.44 }] };
      expect(() => parseHistory(payload, instrument('uk-shel'))).toThrow(/Refusing to chart/);
    });

    it('returns nothing for an empty result rather than throwing', () => {
      expect(parseHistory({ points: [] }, instrument('us-aapl'))).toEqual([]);
      expect(parseHistory({}, instrument('us-aapl'))).toEqual([]);
    });
  });
});
