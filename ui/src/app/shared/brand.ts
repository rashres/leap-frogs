/**
 * Brand colours and marks per instrument, keyed by ticker symbol.
 * Adapted from the team's Angular app (fe/21-page-mascots, shared/brand.ts),
 * which keyed brands by fixture ids; the API identifies instruments by
 * numeric id, so the ticker is the stable key here.
 */

import type { BrandMarkSlug } from './brand-marks';

export type BrandGlyph = 'microsoft' | 'fx' | 'mono';

export interface Brand {
  readonly bg: string;
  readonly fg: string;
  readonly mark?: BrandMarkSlug;
  readonly glyph?: BrandGlyph;
  readonly mono?: string;
  readonly gradient?: readonly [string, string];
}

const MONO = (bg: string, fg: string, mono: string): Brand => ({ bg, fg, glyph: 'mono', mono });
const FX: Brand = { bg: '#1b2430', fg: '#cfe0f5', glyph: 'fx' };

const BRANDS: Readonly<Record<string, Brand>> = {
  AAPL: { bg: '#1d1d1f', fg: '#f5f5f7', mark: 'apple' },
  TSLA: { bg: '#cc0000', fg: '#ffffff', mark: 'tesla' },
  NVDA: { bg: '#76b900', fg: '#0d1a00', mark: 'nvidia' },
  MSFT: { bg: '#12181f', fg: '#ffffff', glyph: 'microsoft' },
  AMZN: MONO('#ff9900', '#141414', 'a'),
  SHEL: { bg: '#fbce07', fg: '#dd1d21', mark: 'shell' },
  HSBA: { bg: '#db0011', fg: '#ffffff', mark: 'hsbc' },
  VOD: { bg: '#e60000', fg: '#ffffff', mark: 'vodafone' },
  RELIANCE: MONO('#0033a0', '#ffffff', 'R'),
  TCS: { bg: '#1c3f94', fg: '#ffffff', mark: 'tcs' },
  INFY: { bg: '#007cc3', fg: '#ffffff', mark: 'infosys' },
  BTC: { bg: '#f7931a', fg: '#ffffff', mark: 'bitcoin' },
  ETH: { bg: '#5b73e8', fg: '#ffffff', mark: 'ethereum' },
  SOL: { bg: '#0e0f16', fg: '#14f195', mark: 'solana', gradient: ['#9945ff', '#14f195'] },
};

const FALLBACK: Brand = { bg: '#1c242e', fg: '#9aa6b4', glyph: 'mono', mono: '•' };

/** Splits an FX ticker ("GBP/USD", "GBPUSD=X") into its two currency codes. */
export function fxPair(symbol: string): { base: string; quote: string } | null {
  const match = /^([A-Z]{3})\/?([A-Z]{3})(=X)?$/.exec(symbol.toUpperCase());
  return match && (symbol.includes('/') || symbol.toUpperCase().endsWith('=X'))
    ? { base: match[1], quote: match[2] }
    : null;
}

/** "SHEL.L" -> "SHEL", "BTC-USD" -> "BTC", "aapl" -> "AAPL". */
function baseTicker(symbol: string): string {
  return symbol.toUpperCase().split('.')[0].replace(/-USD$/, '');
}

export function brandFor(symbol: string): Brand {
  if (fxPair(symbol)) {
    return FX;
  }
  return BRANDS[baseTicker(symbol)] ?? { ...FALLBACK, mono: symbol.slice(0, 1).toUpperCase() };
}
