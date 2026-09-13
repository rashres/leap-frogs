/**
 * Instrument brand marks.
 *
 * Deliberately self-contained: no logo CDN, no network fetch, no bundled image
 * assets. Everything renders as inline SVG or a tinted monogram, so the UI has
 * no external dependency and nothing to 404.
 *
 * Most instruments carry a real brand mark from brand-marks.ts (CC0, inlined).
 * Two exceptions, both because simple-icons has removed them from its set:
 * Microsoft keeps a hand-drawn four-square mark (trivially accurate geometry),
 * and Amazon keeps a tinted monogram. A monogram is a better answer than a
 * badly redrawn logo, and a real deployment would swap in licensed assets.
 *
 * [chore]
 */

import type { BrandMarkSlug } from './brand-marks';

/** Rendering strategies that are not a plain brand mark. */
export type BrandGlyph = 'microsoft' | 'fx' | 'mono';

export interface Brand {
  /** Tile background. */
  readonly bg: string;
  /** Mark / monogram colour. */
  readonly fg: string;
  /** A real brand mark. Takes precedence over `glyph` when set. */
  readonly mark?: BrandMarkSlug;
  /** Fallback rendering when there is no mark. */
  readonly glyph?: BrandGlyph;
  /** Shown when glyph is 'mono'. One or two characters reads best. */
  readonly mono?: string;
  /** Two-stop gradient for the mark, where a flat fill loses the identity. */
  readonly gradient?: readonly [string, string];
}

const MONO = (bg: string, fg: string, mono: string): Brand => ({ bg, fg, glyph: 'mono', mono });

export const BRANDS: Readonly<Record<string, Brand>> = {
  // ---- Equities US ----
  'us-aapl': { bg: '#1d1d1f', fg: '#f5f5f7', mark: 'apple' },
  'us-tsla': { bg: '#cc0000', fg: '#ffffff', mark: 'tesla' },
  'us-nvda': { bg: '#76b900', fg: '#0d1a00', mark: 'nvidia' },
  // Microsoft and Amazon are not in the CC0 set — see the file comment.
  'us-msft': { bg: '#12181f', fg: '#ffffff', glyph: 'microsoft' },
  'us-amzn': MONO('#ff9900', '#141414', 'a'),

  // ---- Equities UK ----
  // Shell's pecten is red on the corporate yellow, as the real mark is.
  'uk-shel': { bg: '#fbce07', fg: '#dd1d21', mark: 'shell' },
  'uk-hsba': { bg: '#db0011', fg: '#ffffff', mark: 'hsbc' },
  'uk-vod': { bg: '#e60000', fg: '#ffffff', mark: 'vodafone' },

  // ---- Equities India ----
  'in-reliance': MONO('#0033a0', '#ffffff', 'R'),
  'in-tcs': { bg: '#1c3f94', fg: '#ffffff', mark: 'tcs' },
  'in-infy': { bg: '#007cc3', fg: '#ffffff', mark: 'infosys' },

  // ---- FX (rendered as a split disc of the two currency symbols) ----
  'fx-gbpusd': { bg: '#1b2430', fg: '#cfe0f5', glyph: 'fx' },
  'fx-eurusd': { bg: '#1b2430', fg: '#cfe0f5', glyph: 'fx' },
  'fx-usdinr': { bg: '#1b2430', fg: '#cfe0f5', glyph: 'fx' },

  // ---- Crypto ----
  'crypto-btc': { bg: '#f7931a', fg: '#ffffff', mark: 'bitcoin' },
  'crypto-eth': { bg: '#5b73e8', fg: '#ffffff', mark: 'ethereum' },
  // Solana's identity is the gradient; a flat fill reads as a generic glyph.
  'crypto-sol': {
    bg: '#0e0f16',
    fg: '#14f195',
    mark: 'solana',
    gradient: ['#9945ff', '#14f195'],
  },
};

const FALLBACK: Brand = { bg: '#1c242e', fg: '#9aa6b4', glyph: 'mono', mono: '•' };

export function brandFor(instrumentId: string, symbol: string): Brand {
  const known = BRANDS[instrumentId];
  if (known) return known;
  // Unknown instrument: tint a monogram from its ticker so it still reads.
  return { ...FALLBACK, mono: symbol.slice(0, 1).toUpperCase() };
}
