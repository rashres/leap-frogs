/**
 * Persistence round-trip tests.
 *
 * The point of these is exactness. `Decimal` holds a `bigint`, `JSON.stringify`
 * throws on bigint, and a lossy workaround (storing amounts as JS numbers)
 * would reintroduce float error into balances — precisely what the money layer
 * exists to prevent. So these assert that what comes back is bit-for-bit what
 * went in, at every scale the platform uses.
 *
 * [chore]
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Decimal } from '../money/decimal';
import { Money } from '../money/money';
import { DemoStore } from './persistence';
import type { Order } from '../domain/order';
import type { CashBalance, Position } from '../domain/portfolio';

const ACCOUNT = 'acc-leap-0001';

function makeOrder(): Order {
  return {
    id: 'ord-000001',
    reference: 'LEAP-2026-00001',
    accountId: ACCOUNT,
    instrumentId: 'crypto-btc',
    symbol: 'BTC',
    instrumentName: 'Bitcoin',
    currency: 'USD',
    side: 'BUY',
    quantity: Decimal.parse('0.05000000'),
    state: 'FILLED',
    submittedAt: new Date('2026-08-29T12:00:00.000Z'),
    indicativeQuote: {
      rate: Decimal.parse('93624.33'),
      price: Money.of('93624.33', 'USD'),
      observedAt: new Date('2026-08-29T11:59:59.000Z'),
    },
    executionQuote: {
      rate: Decimal.parse('93352.82'),
      price: Money.of('93352.82', 'USD'),
      observedAt: new Date('2026-08-29T12:00:01.000Z'),
    },
    consideration: Money.of('-4667.64', 'USD'),
    filledAt: new Date('2026-08-29T12:00:01.500Z'),
    transitions: [
      { at: new Date('2026-08-29T12:00:00.000Z'), from: null, to: 'SUBMITTED', detail: 'BUY 0.05 BTC' },
      { at: new Date('2026-08-29T12:00:00.100Z'), from: 'SUBMITTED', to: 'ACCEPTED', detail: 'Validated' },
      { at: new Date('2026-08-29T12:00:01.500Z'), from: 'ACCEPTED', to: 'FILLED', detail: 'Filled' },
    ],
  };
}

describe('DemoStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips positions and cash with no loss of precision', () => {
    const positions: Position[] = [
      {
        accountId: ACCOUNT,
        instrumentId: 'crypto-btc',
        // 8dp crypto quantity — the widest scale in the platform.
        quantity: Decimal.parse('0.47500000'),
        averageCost: Money.of('82604.51', 'USD'),
      },
      {
        accountId: ACCOUNT,
        instrumentId: 'uk-shel',
        quantity: Decimal.parse('450'),
        averageCost: Money.of('26.10', 'GBP'),
      },
    ];
    const cash: CashBalance[] = [
      { accountId: ACCOUNT, currency: 'USD', available: Money.of('28112.91', 'USD') },
      { accountId: ACCOUNT, currency: 'INR', available: Money.of('415600.00', 'INR') },
    ];

    new DemoStore().savePortfolio(positions, cash);
    const restored = new DemoStore().restorePortfolio();

    expect(restored).not.toBeNull();
    expect(restored!.positions[0].quantity.toString()).toBe('0.47500000');
    expect(restored!.positions[0].quantity.scale).toBe(8);
    expect(restored!.positions[0].averageCost.format()).toBe('$82,604.51');
    expect(restored!.positions[1].quantity.toString()).toBe('450');
    expect(restored!.positions[1].averageCost.currency).toBe('GBP');
    expect(restored!.cash[0].available.format()).toBe('$28,112.91');
    expect(restored!.cash[1].available.format()).toBe('₹415,600.00');
  });

  it('survives a bigint that would overflow a JS number', () => {
    // Well beyond Number.MAX_SAFE_INTEGER, to prove nothing is coerced to float.
    const huge = Decimal.ofUnscaled(9007199254740993n * 1000n, 8);
    new DemoStore().savePortfolio(
      [{ accountId: ACCOUNT, instrumentId: 'crypto-btc', quantity: huge, averageCost: Money.zero('USD') }],
      [],
    );
    const restored = new DemoStore().restorePortfolio();
    expect(restored!.positions[0].quantity.unscaled).toBe(9007199254740993n * 1000n);
    expect(restored!.positions[0].quantity.toString()).toBe(huge.toString());
  });

  it('round-trips a full order including both recorded quote facts', () => {
    const order = makeOrder();
    new DemoStore().saveOrders([order], 2);
    const restored = new DemoStore().restoreOrders();

    expect(restored).not.toBeNull();
    expect(restored!.nextSequence).toBe(2);

    const back = restored!.orders[0];
    expect(back.reference).toBe('LEAP-2026-00001');
    expect(back.state).toBe('FILLED');
    expect(back.quantity.toString()).toBe('0.05000000');
    // BR-14: both quotes and both observation timestamps must survive.
    expect(back.indicativeQuote.rate.toString()).toBe('93624.33');
    expect(back.indicativeQuote.observedAt.toISOString()).toBe('2026-08-29T11:59:59.000Z');
    expect(back.executionQuote!.rate.toString()).toBe('93352.82');
    expect(back.executionQuote!.observedAt.toISOString()).toBe('2026-08-29T12:00:01.000Z');
    expect(back.consideration!.format()).toBe('-$4,667.64');
    expect(back.transitions).toHaveLength(3);
    expect(back.transitions[0].from).toBeNull();
    expect(back.transitions[2].to).toBe('FILLED');
    expect(back.transitions[2].at.toISOString()).toBe('2026-08-29T12:00:01.500Z');
  });

  it('reports nothing to restore on a clean session', () => {
    expect(new DemoStore().restorePortfolio()).toBeNull();
    expect(new DemoStore().restoreOrders()).toBeNull();
  });

  it('discards state written under a different shape rather than crashing', () => {
    localStorage.setItem('leap.demo.v1', JSON.stringify({ version: 99, nonsense: true }));
    expect(new DemoStore().restorePortfolio()).toBeNull();
  });

  it('discards unparseable state rather than crashing', () => {
    localStorage.setItem('leap.demo.v1', 'not json at all');
    expect(new DemoStore().restoreOrders()).toBeNull();
  });
});
