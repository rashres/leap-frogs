/**
 * Live market data from Yahoo Finance, via a local yfinance-backed service.
 *
 * A deviation from Prompt 2, which ruled out a vendor feed. It is contained
 * rather than pervasive: this is one implementation of QuoteProvider, it is not
 * the default, and no test depends on it. See docs/open-questions.md OQ-10.
 *
 * Three things about this source are worth knowing before changing anything:
 *
 * 1. **The browser never talks to Yahoo.** Every request goes through the
 *    dev-server proxy at /api/yahoo (proxy.conf.mjs), which forwards to a local
 *    Python process (backend/main.py) wrapping the open-source `yfinance`
 *    client. That process is what actually reaches Yahoo — one server-side IP
 *    instead of every developer's browser. A deployed build needs the Spring
 *    backend to own this instead.
 *
 * 2. **The LSE quotes in pence.** SHEL.L comes back as 3344.5 with currency
 *    "GBp", not "GBP". Treated naively that is £3,344.50 instead of £33.45 — a
 *    hundredfold error in every holding, balance and P/L on the page. The
 *    quoting currency is declared per symbol below and converted explicitly,
 *    and an unrecognised currency is refused rather than guessed at.
 *
 * 3. **Its numbers arrive as JSON floats.** JSON.parse produces doubles, which
 *    CLAUDE.md bans anywhere near a price. Every value is stringified and
 *    re-parsed through Decimal immediately, and never used as a number.
 *
 * [US-15][US-16]
 */

import { Injectable } from '@angular/core';
import { Decimal } from '../money/decimal';
import type { CurrencyCode } from '../money/currency';
import { policyFor } from '../domain/instrument';
import type { ChartRange, FixtureInstrument, PricePoint } from './fixtures';
import type { ProviderQuote, QuoteProvider } from './quote-provider';

const PROXY = '/api/yahoo';

/** Currencies a venue may quote in, including the LSE's pence. */
export type QuotedCurrency = CurrencyCode | 'GBp';

export interface YahooSymbol {
  readonly symbol: string;
  /** What the venue quotes in — NOT necessarily the settlement currency. */
  readonly quotedIn: QuotedCurrency;
}

/** Instrument id to Yahoo ticker. `.L` = LSE, `.NS` = NSE, `=X` = FX, `-USD` = crypto. */
export const YAHOO_SYMBOLS: Readonly<Record<string, YahooSymbol>> = {
  'us-aapl': { symbol: 'AAPL', quotedIn: 'USD' },
  'us-nvda': { symbol: 'NVDA', quotedIn: 'USD' },
  'us-tsla': { symbol: 'TSLA', quotedIn: 'USD' },
  'us-msft': { symbol: 'MSFT', quotedIn: 'USD' },
  'us-amzn': { symbol: 'AMZN', quotedIn: 'USD' },

  // London quotes in pence. This is the line that prevents a 100x error.
  'uk-shel': { symbol: 'SHEL.L', quotedIn: 'GBp' },
  'uk-hsba': { symbol: 'HSBA.L', quotedIn: 'GBp' },
  'uk-vod': { symbol: 'VOD.L', quotedIn: 'GBp' },

  'in-reliance': { symbol: 'RELIANCE.NS', quotedIn: 'INR' },
  'in-tcs': { symbol: 'TCS.NS', quotedIn: 'INR' },
  'in-infy': { symbol: 'INFY.NS', quotedIn: 'INR' },

  'fx-gbpusd': { symbol: 'GBPUSD=X', quotedIn: 'USD' },
  'fx-eurusd': { symbol: 'EURUSD=X', quotedIn: 'USD' },
  'fx-usdinr': { symbol: 'USDINR=X', quotedIn: 'INR' },

  'crypto-btc': { symbol: 'BTC-USD', quotedIn: 'USD' },
  'crypto-eth': { symbol: 'ETH-USD', quotedIn: 'USD' },
  'crypto-sol': { symbol: 'SOL-USD', quotedIn: 'USD' },
};

/** Chart range to the backend's yfinance range code (matches ChartRange values it accepts). */
export const YAHOO_RANGES: Readonly<Record<ChartRange, string>> = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1Y',
  ALL: 'ALL',
};

/**
 * Converts a JSON number to an exact Decimal without ever using it as a number.
 *
 * `String(n)` yields the shortest decimal literal that round-trips to the same
 * double, which for market prices is the literal the API actually sent. The
 * exponential guard covers pathological values that Decimal.parse would reject.
 */
export function decimalFromJson(value: number, scale: number): Decimal {
  const text = String(value);
  const safe = /[eE]/.test(text) ? value.toFixed(Math.max(scale, 8)) : text;
  return Decimal.parse(safe).rescale(scale, 'HALF_EVEN');
}

/**
 * Restates a venue-quoted price in the instrument's settlement currency.
 *
 * The only conversion permitted here is a unit change within one currency
 * (pence to pounds). It is NOT an FX conversion — this platform never converts
 * between currencies implicitly. Anything unrecognised throws rather than
 * silently mis-scaling by a factor of a hundred.
 */
export function toSettlementRate(
  raw: Decimal,
  quotedIn: QuotedCurrency,
  settlement: CurrencyCode,
  scale: number,
): Decimal {
  if (quotedIn === 'GBp') {
    if (settlement !== 'GBP') {
      throw new TypeError(`GBp quote cannot settle in ${settlement}`);
    }
    return raw.divide(Decimal.ofInteger(100), scale, 'HALF_EVEN');
  }
  if (quotedIn !== settlement) {
    throw new TypeError(`Quote currency ${quotedIn} does not match settlement currency ${settlement}`);
  }
  return raw.rescale(scale, 'HALF_EVEN');
}

// ---- Response shapes (only the fields actually read) ------------------------

/** One row from the backend's /quotes endpoint. */
interface QuoteEntry {
  readonly symbol?: string;
  readonly price?: number;
  readonly previousClose?: number;
  readonly currency?: string;
}

/** One row from the backend's /history/{symbol} endpoint. */
interface HistoryPoint {
  readonly timestamp?: number;
  readonly close?: number;
}

interface HistoryResponse {
  readonly currency?: string | null;
  readonly points?: HistoryPoint[];
}

const priceScaleOf = (instrument: FixtureInstrument): number =>
  instrument.priceScale ?? policyFor(instrument.classCode).priceScale;

/**
 * Turns an HTTP status into something a user can act on.
 *
 * 429 is not hypothetical: yfinance's own upstream is Yahoo's unofficial,
 * unauthenticated, shared public endpoint, and it throttles by IP without
 * warning. Running server-side (backend/main.py) rather than from the browser
 * means one IP for the whole team instead of one per developer, which makes
 * this rarer but does not eliminate it.
 */
export function describeFailure(status: number, what: string): string {
  if (status === 429) {
    return `The market-data service is being rate-limited (429). Live ${what} paused; showing the last good prices.`;
  }
  if (status === 502) {
    return `The market-data service could not reach Yahoo for ${what}.`;
  }
  if (status >= 500) {
    return `The market-data service is unavailable (${status}). Showing the last good prices.`;
  }
  return `Market-data ${what} request failed (HTTP ${status}). Is the backend running (see backend/README)?`;
}

/** Parses a /quotes payload into provider quotes. Pure, so tests need no network. */
export function parseQuotes(
  payload: readonly QuoteEntry[],
  instruments: readonly FixtureInstrument[],
): ProviderQuote[] {
  const bySymbol = new Map(payload.filter((q) => q.symbol).map((q) => [q.symbol as string, q]));
  const quotes: ProviderQuote[] = [];

  for (const instrument of instruments) {
    const mapping = YAHOO_SYMBOLS[instrument.id];
    if (!mapping) continue;
    const entry = bySymbol.get(mapping.symbol);
    if (!entry) continue;
    if (typeof entry.price !== 'number' || typeof entry.previousClose !== 'number') continue;

    const scale = priceScaleOf(instrument);
    const rawRate = decimalFromJson(entry.price, scale + 4);
    const rawPrevious = decimalFromJson(entry.previousClose, scale + 4);

    try {
      quotes.push({
        instrumentId: instrument.id,
        rate: toSettlementRate(rawRate, mapping.quotedIn, instrument.currency, scale),
        previousClose: toSettlementRate(rawPrevious, mapping.quotedIn, instrument.currency, scale),
        currency: instrument.currency,
        observedAt: new Date(),
      });
    } catch (error) {
      // A currency we do not understand is dropped, not guessed at. The caller
      // keeps its previous good quote for this instrument.
      console.warn(`[yahoo] skipping ${instrument.symbol}:`, error);
    }
  }

  return quotes;
}

/** Parses a /history payload into a price series. Pure. */
export function parseHistory(payload: HistoryResponse, instrument: FixtureInstrument): PricePoint[] {
  const mapping = YAHOO_SYMBOLS[instrument.id];
  if (!mapping) return [];

  // The backend reports the currency yfinance observed. Use it to verify the
  // declared mapping rather than trusting the table blindly.
  const reported = payload.currency;
  if (reported && reported !== mapping.quotedIn) {
    throw new TypeError(
      `${instrument.symbol}: service reports ${reported} but the symbol map declares ${mapping.quotedIn}. ` +
        'Refusing to chart a price whose units are not what the code expects.',
    );
  }

  const scale = priceScaleOf(instrument);
  const points: PricePoint[] = [];

  for (const point of payload.points ?? []) {
    if (typeof point.close !== 'number' || typeof point.timestamp !== 'number') continue;
    points.push({
      at: new Date(point.timestamp * 1000),
      price: toSettlementRate(
        decimalFromJson(point.close, scale + 4),
        mapping.quotedIn,
        instrument.currency,
        scale,
      ),
    });
  }

  return points;
}

/** One match from a symbol search, trimmed to what the UI shows. */
export interface LiveSearchResult {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly type: string;
}

interface SearchEntry {
  readonly symbol?: string;
  readonly name?: string;
  readonly exchange?: string;
  readonly type?: string;
}

/** Parses a /search payload into display-ready results. Pure. */
export function parseSearch(payload: readonly SearchEntry[]): LiveSearchResult[] {
  return payload
    .filter((q): q is SearchEntry & { symbol: string } => Boolean(q.symbol))
    .map((q) => ({
      symbol: q.symbol,
      name: q.name ?? q.symbol,
      exchange: q.exchange ?? 'Unknown',
      type: q.type ?? 'EQUITY',
    }));
}

@Injectable({ providedIn: 'root' })
export class YahooQuoteProvider implements QuoteProvider {
  readonly id = 'yahoo' as const;
  readonly label = 'Yahoo Finance';
  /** Slower than the fixture walk: this is a shared public endpoint. */
  readonly pollMs = 15_000;

  /**
   * Free-text symbol/name lookup against the whole market, not just the
   * fixture universe — this is what lets a search surface a stock the app
   * has no local instrument record for. Read-only: a result here never
   * becomes tradeable, it is informational only. See OQ-10.
   */
  async search(query: string): Promise<readonly LiveSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const url = `${PROXY}/search?q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(describeFailure(response.status, 'search'));
    return parseSearch((await response.json()) as SearchEntry[]);
  }

  async refresh(instruments: readonly FixtureInstrument[]): Promise<readonly ProviderQuote[]> {
    const symbols = instruments
      .map((i) => YAHOO_SYMBOLS[i.id]?.symbol)
      .filter((s): s is string => Boolean(s));
    if (symbols.length === 0) return [];

    // One batched request for the whole universe, rather than one per symbol.
    // This matters: the upstream throttles by IP and a per-symbol poll would
    // trip it almost immediately.
    const url = `${PROXY}/quotes?symbols=${encodeURIComponent(symbols.join(','))}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(describeFailure(response.status, 'quotes'));
    return parseQuotes((await response.json()) as QuoteEntry[], instruments);
  }

  async history(
    instrument: FixtureInstrument,
    range: ChartRange,
  ): Promise<readonly PricePoint[] | null> {
    const mapping = YAHOO_SYMBOLS[instrument.id];
    if (!mapping) return null;

    const url = `${PROXY}/history/${encodeURIComponent(mapping.symbol)}?range=${YAHOO_RANGES[range]}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(describeFailure(response.status, 'history'));

    const points = parseHistory((await response.json()) as HistoryResponse, instrument);
    return points.length >= 2 ? points : null;
  }
}
