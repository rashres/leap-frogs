/**
 * Pre-trade validation tests.
 *
 * CLAUDE.md requires pre-trade validation to run before an order is ever
 * accepted, and requires rejection to be a first-class outcome carrying a
 * reason code. These tests assert exactly that: every rejection path returns a
 * REJECTED outcome with the right code, and nothing throws.
 *
 * [US-07]
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Decimal } from '../money/decimal';
import { MarketDataService } from './market-data.service';
import { PortfolioService } from './portfolio.service';
import { PreTradeValidator } from './pre-trade-validator';
import { OrderService } from './order.service';
import type { PreTradeOutcome } from '../domain/order';

/** Thursday 27 Aug 2026, 09:00 UTC — LSE open, US pre-open. */
const LSE_OPEN = new Date('2026-08-27T09:00:00Z');

function reasonOf(outcome: PreTradeOutcome): string | null {
  return outcome.kind === 'REJECTED' ? outcome.reason.code : null;
}

describe('PreTradeValidator', () => {
  let validator: PreTradeValidator;
  let market: MarketDataService;
  let portfolio: PortfolioService;
  let orders: OrderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    validator = TestBed.inject(PreTradeValidator);
    market = TestBed.inject(MarketDataService);
    portfolio = TestBed.inject(PortfolioService);
    orders = TestBed.inject(OrderService);
  });

  const priceOf = (id: string) => market.latestQuote(id).price;
  const considerationFor = (id: string, quantity: Decimal) =>
    orders.considerationFor(priceOf(id), quantity);

  it('accepts a well-formed crypto buy within cash', () => {
    const btc = market.requireInstrument('crypto-btc');
    const quantity = Decimal.parse('0.05000000');
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity,
      consideration: considerationFor(btc.id, quantity),
    });
    expect(outcome.kind).toBe('ACCEPTED');
  });

  it('rejects a non-positive quantity', () => {
    const btc = market.requireInstrument('crypto-btc');
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity: Decimal.parse('0'),
      consideration: null,
    });
    expect(reasonOf(outcome)).toBe('QUANTITY_NOT_POSITIVE');
  });

  it('rejects an instrument that is not tradeable', () => {
    // VOD is seeded as suspended precisely so this path has something to find.
    const vod = market.requireInstrument('uk-vod');
    const quantity = Decimal.parse('10');
    const outcome = validator.validate({
      instrument: vod,
      side: 'BUY',
      quantity,
      consideration: considerationFor(vod.id, quantity),
      at: LSE_OPEN,
    });
    expect(reasonOf(outcome)).toBe('INSTRUMENT_NOT_TRADEABLE');
  });

  it('rejects an order placed while the instrument class is closed', () => {
    const shel = market.requireInstrument('uk-shel');
    const quantity = Decimal.parse('10');
    const outcome = validator.validate({
      instrument: shel,
      side: 'BUY',
      quantity,
      consideration: considerationFor(shel.id, quantity),
      // Saturday — the LSE is shut.
      at: new Date('2026-08-29T09:00:00Z'),
    });
    expect(reasonOf(outcome)).toBe('MARKET_CLOSED');
  });

  it('rejects a fractional quantity on a whole-units-only class', () => {
    const shel = market.requireInstrument('uk-shel');
    const quantity = Decimal.parse('10.5');
    const outcome = validator.validate({
      instrument: shel,
      side: 'BUY',
      quantity,
      consideration: considerationFor(shel.id, quantity),
      at: LSE_OPEN,
    });
    expect(reasonOf(outcome)).toBe('FRACTIONAL_NOT_PERMITTED');
  });

  it('rejects more decimal places than the class permits', () => {
    const btc = market.requireInstrument('crypto-btc');
    // Crypto allows 8dp; this is 9.
    const quantity = Decimal.parse('0.123456789');
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity,
      consideration: considerationFor(btc.id, quantity),
    });
    expect(reasonOf(outcome)).toBe('QUANTITY_PRECISION_EXCEEDED');
  });

  it('rejects a buy the settlement-currency balance cannot cover', () => {
    const btc = market.requireInstrument('crypto-btc');
    // 5 BTC is far beyond the seeded USD balance.
    const quantity = Decimal.parse('5.00000000');
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity,
      consideration: considerationFor(btc.id, quantity),
    });
    expect(reasonOf(outcome)).toBe('INSUFFICIENT_CASH');
  });

  it('checks cash in the instrument currency only, never a converted total', () => {
    // The account holds ample GBP and INR, but a USD-settled instrument may
    // only be bought with USD. This is the locked no-auto-FX cash model.
    const gbp = portfolio.cashFor('GBP');
    const usd = portfolio.cashFor('USD');
    expect(gbp.isZero()).toBe(false);

    const btc = market.requireInstrument('crypto-btc');
    // Sized to exceed USD but sit far below the combined balances.
    const quantity = usd.amount.divide(priceOf(btc.id).amount, 8, 'DOWN').plus(Decimal.parse('0.10000000'));
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity,
      consideration: considerationFor(btc.id, quantity),
    });
    expect(reasonOf(outcome)).toBe('INSUFFICIENT_CASH');
  });

  it('rejects a sell larger than the holding', () => {
    const btc = market.requireInstrument('crypto-btc');
    const quantity = Decimal.parse('10.00000000');
    const outcome = validator.validate({
      instrument: btc,
      side: 'SELL',
      quantity,
      consideration: considerationFor(btc.id, quantity),
    });
    expect(reasonOf(outcome)).toBe('INSUFFICIENT_HOLDINGS');
  });

  it('accepts a sell within the holding', () => {
    const btc = market.requireInstrument('crypto-btc');
    const held = portfolio.heldQuantity('crypto-btc');
    expect(held.isPositive()).toBe(true);
    const outcome = validator.validate({
      instrument: btc,
      side: 'SELL',
      quantity: Decimal.parse('0.10000000'),
      consideration: considerationFor(btc.id, Decimal.parse('0.10000000')),
    });
    expect(outcome.kind).toBe('ACCEPTED');
  });

  it('rejects when no quote is available', () => {
    const btc = market.requireInstrument('crypto-btc');
    const outcome = validator.validate({
      instrument: btc,
      side: 'BUY',
      quantity: Decimal.parse('0.01000000'),
      consideration: null,
    });
    expect(reasonOf(outcome)).toBe('NO_QUOTE_AVAILABLE');
  });

  it('never throws for a business rejection', () => {
    const shel = market.requireInstrument('uk-shel');
    expect(() =>
      validator.validate({
        instrument: shel,
        side: 'SELL',
        quantity: Decimal.parse('999999'),
        consideration: considerationFor(shel.id, Decimal.parse('999999')),
        at: LSE_OPEN,
      }),
    ).not.toThrow();
  });
});
