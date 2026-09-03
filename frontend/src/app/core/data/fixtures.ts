/**
 * Fixture instrument universe and deterministic price generation.
 *
 * Prompt 2 / PS-04 calls for "a QuoteProvider interface with a fixture-backed
 * implementation for local and test use. Do not integrate a real vendor feed."
 * This is that fixture source, on the frontend side.
 *
 * Prices are generated as integer minor units and walked with integer basis
 * point steps, so no float is involved at any stage of producing a price.
 * Seeding is deterministic: the same instrument yields the same history on every
 * reload, which is what makes the pricing behaviour reviewable.
 *
 * [US-15]
 */

import { Decimal } from '../money/decimal';
import type { Instrument, InstrumentClassCode } from '../domain/instrument';
import type { CurrencyCode } from '../money/currency';

/** mulberry32 — small, fast, fully deterministic. Returns a uint32 per call. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % 1_000_000;
  };
}

/** Stable integer seed from a string, so an instrument's history never shifts. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface FixtureInstrument extends Instrument {
  /** Opening reference price as a decimal string, in the instrument's own currency. */
  readonly seedPrice: string;
  /** Typical per-step move in basis points. Drives how jumpy the chart looks. */
  readonly volatilityBp: number;
  /**
   * Overrides the class's default price scale.
   *
   * A sub-£1 LSE line cannot be quoted meaningfully to £0.01: a normal day's
   * move is smaller than one penny, so at 2dp the price would never appear to
   * change. Real venues quote these in pence to 2dp, which is 4dp in pounds.
   */
  readonly priceScale?: number;
}

const equityUs = (
  symbol: string,
  name: string,
  seedPrice: string,
  volatilityBp: number,
): FixtureInstrument => ({
  id: `us-${symbol.toLowerCase()}`,
  symbol,
  name,
  classCode: 'EQUITIES_US',
  currency: 'USD',
  exchange: 'NASDAQ',
  tradeable: true,
  seedPrice,
  volatilityBp,
});

export const FIXTURE_INSTRUMENTS: readonly FixtureInstrument[] = [
  // ---- Equities US (USD, fractional permitted) ----
  equityUs('AAPL', 'Apple Inc.', '229.45', 90),
  equityUs('NVDA', 'NVIDIA Corporation', '183.22', 170),
  equityUs('TSLA', 'Tesla, Inc.', '412.60', 220),
  equityUs('MSFT', 'Microsoft Corporation', '486.15', 80),
  equityUs('AMZN', 'Amazon.com, Inc.', '241.88', 110),

  // ---- Equities UK (GBP, whole shares only) ----
  {
    id: 'uk-shel',
    symbol: 'SHEL',
    name: 'Shell plc',
    classCode: 'EQUITIES_UK',
    currency: 'GBP',
    exchange: 'LSE',
    tradeable: true,
    seedPrice: '28.74',
    volatilityBp: 70,
  },
  {
    id: 'uk-hsba',
    symbol: 'HSBA',
    name: 'HSBC Holdings plc',
    classCode: 'EQUITIES_UK',
    currency: 'GBP',
    exchange: 'LSE',
    tradeable: true,
    seedPrice: '9.86',
    volatilityBp: 65,
  },
  {
    id: 'uk-vod',
    symbol: 'VOD',
    name: 'Vodafone Group plc',
    classCode: 'EQUITIES_UK',
    currency: 'GBP',
    exchange: 'LSE',
    // Deliberately untradeable: gives pre-trade validation a real rejection to find.
    tradeable: false,
    suspensionNote: 'Suspended pending corporate announcement',
    seedPrice: '0.7845',
    volatilityBp: 95,
    // 78.45p — quoted to the tenth of a penny, as the venue would.
    priceScale: 4,
  },

  // ---- Equities India (INR, whole shares only) ----
  {
    id: 'in-reliance',
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    classCode: 'EQUITIES_INDIA',
    currency: 'INR',
    exchange: 'NSE',
    tradeable: true,
    seedPrice: '1489.30',
    volatilityBp: 85,
  },
  {
    id: 'in-tcs',
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    classCode: 'EQUITIES_INDIA',
    currency: 'INR',
    exchange: 'NSE',
    tradeable: true,
    seedPrice: '3204.55',
    volatilityBp: 75,
  },
  {
    id: 'in-infy',
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    classCode: 'EQUITIES_INDIA',
    currency: 'INR',
    exchange: 'NSE',
    tradeable: true,
    seedPrice: '1618.20',
    volatilityBp: 80,
  },

  // ---- FX (priced in the quote currency of the pair) ----
  {
    id: 'fx-gbpusd',
    symbol: 'GBP/USD',
    name: 'Pound sterling / US dollar',
    classCode: 'FX',
    currency: 'USD',
    exchange: 'FX',
    tradeable: true,
    seedPrice: '1.34215',
    volatilityBp: 25,
  },
  {
    id: 'fx-eurusd',
    symbol: 'EUR/USD',
    name: 'Euro / US dollar',
    classCode: 'FX',
    currency: 'USD',
    exchange: 'FX',
    tradeable: true,
    seedPrice: '1.16480',
    volatilityBp: 22,
  },
  {
    id: 'fx-usdinr',
    symbol: 'USD/INR',
    name: 'US dollar / Indian rupee',
    classCode: 'FX',
    currency: 'INR',
    exchange: 'FX',
    tradeable: true,
    seedPrice: '88.4250',
    volatilityBp: 30,
  },

  // ---- Crypto (USD-settled, 8dp fractional, never closes) ----
  {
    id: 'crypto-btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    classCode: 'CRYPTO',
    currency: 'USD',
    exchange: 'Crypto',
    tradeable: true,
    seedPrice: '94820.00',
    volatilityBp: 190,
  },
  {
    id: 'crypto-eth',
    symbol: 'ETH',
    name: 'Ethereum',
    classCode: 'CRYPTO',
    currency: 'USD',
    exchange: 'Crypto',
    tradeable: true,
    seedPrice: '3142.75',
    volatilityBp: 240,
  },
  {
    id: 'crypto-sol',
    symbol: 'SOL',
    name: 'Solana',
    classCode: 'CRYPTO',
    currency: 'USD',
    exchange: 'Crypto',
    tradeable: true,
    seedPrice: '186.40',
    volatilityBp: 320,
  },
];

export const CHART_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

interface RangeShape {
  readonly points: number;
  readonly stepMs: number;
  /** Volatility multiplier — a year of daily closes moves more than an hour of ticks. */
  readonly volatilityScale: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RANGE_SHAPES: Readonly<Record<ChartRange, RangeShape>> = {
  '1D': { points: 78, stepMs: 5 * MINUTE, volatilityScale: 1 },
  '1W': { points: 84, stepMs: 2 * HOUR, volatilityScale: 2 },
  '1M': { points: 60, stepMs: 12 * HOUR, volatilityScale: 4 },
  '3M': { points: 90, stepMs: DAY, volatilityScale: 6 },
  '1Y': { points: 104, stepMs: 3.5 * DAY, volatilityScale: 11 },
  ALL: { points: 120, stepMs: 10 * DAY, volatilityScale: 20 },
};

export interface PricePoint {
  readonly at: Date;
  readonly price: Decimal;
}

/**
 * Builds a price series that ENDS at `currentPrice`.
 *
 * The walk runs backwards from the live price so the right-hand edge of every
 * chart always agrees with the price shown beside it. Steps are integer basis
 * point moves applied to bigint minor units — no float arithmetic.
 */
export function seriesEndingAt(
  currentPrice: Decimal,
  range: ChartRange,
  volatilityBp: number,
  seedKey: string,
): PricePoint[] {
  const { points, stepMs, volatilityScale } = RANGE_SHAPES[range];
  const next = seededRandom(seedOf(`${seedKey}:${range}`));
  const swing = Math.max(4, Math.round(volatilityBp * volatilityScale));

  const scale = currentPrice.scale;
  const reversed: bigint[] = [currentPrice.unscaled];
  let cursor = currentPrice.unscaled;

  for (let i = 1; i < points; i++) {
    // Integer basis-point move in [-swing, +swing], with a slight upward drift
    // so the long ranges tend to look like a market that went up, as most do.
    //
    // The walk runs BACKWARDS, so the drift sign is inverted relative to
    // intuition: a positive mean bp makes each older point lower than the one
    // after it, which reads left-to-right as a rising market.
    const bp = BigInt((next() % (2 * swing + 1)) - swing + Math.round(swing * 0.06));
    const delta = (cursor * bp) / 10_000n;
    cursor = cursor - delta;
    if (cursor < 1n) cursor = 1n;
    reversed.push(cursor);
  }

  const endMs = Date.now();
  return reversed
    .map((unscaled, index) => ({
      at: new Date(endMs - index * stepMs),
      price: Decimal.ofUnscaled(unscaled, scale),
    }))
    .reverse();
}

/** Per-instrument seeded generator for the next live tick. */
export function tickGenerator(instrumentId: string): () => number {
  return seededRandom(seedOf(`tick:${instrumentId}`));
}

// ---- Account fixtures -------------------------------------------------------

export const DEMO_ACCOUNT_ID = 'acc-leap-0001';
export const DEMO_CLIENT_NAME = 'Rohin Raina';

/** [US-13] Cash held per currency. Not one balance — a set of them. */
export const FIXTURE_CASH: readonly { currency: CurrencyCode; amount: string }[] = [
  { currency: 'GBP', amount: '18450.00' },
  { currency: 'USD', amount: '32780.55' },
  { currency: 'INR', amount: '415600.00' },
];

/** [US-12] Opening holdings. averageCost is in the instrument's own currency. */
export const FIXTURE_POSITIONS: readonly {
  instrumentId: string;
  quantity: string;
  averageCost: string;
}[] = [
  { instrumentId: 'us-aapl', quantity: '85', averageCost: '198.40' },
  { instrumentId: 'us-nvda', quantity: '140', averageCost: '142.75' },
  { instrumentId: 'us-msft', quantity: '32', averageCost: '501.20' },
  { instrumentId: 'uk-shel', quantity: '450', averageCost: '26.10' },
  { instrumentId: 'uk-hsba', quantity: '1200', averageCost: '8.94' },
  { instrumentId: 'in-reliance', quantity: '160', averageCost: '1402.65' },
  { instrumentId: 'in-tcs', quantity: '45', averageCost: '3380.10' },
  { instrumentId: 'crypto-btc', quantity: '0.42500000', averageCost: '81340.00' },
  { instrumentId: 'crypto-eth', quantity: '6.80000000', averageCost: '2905.30' },
];

export const FIXTURE_WATCHLIST: readonly string[] = [
  'crypto-btc',
  'us-tsla',
  'crypto-sol',
  'us-amzn',
  'fx-gbpusd',
  'in-infy',
];

export function instrumentClassOrder(code: InstrumentClassCode): number {
  return ['EQUITIES_US', 'EQUITIES_UK', 'EQUITIES_INDIA', 'FX', 'CRYPTO'].indexOf(code);
}
