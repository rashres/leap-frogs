/**
 * Quote access for the whole application.
 *
 * PS-04 / Prompt 2. Quotes are immutable observations: each carries its
 * instrument, price, currency and the timestamp it was observed at. A refresh
 * publishes NEW quotes, it never edits existing ones.
 *
 * Where the numbers come from is decided by QuoteProvider (fixtures by default,
 * Yahoo optionally). This service's public API is identical either way, so no
 * component knows or cares which source is active — swapping the source cannot
 * change how an order is priced, validated or recorded.
 *
 * The service always seeds synchronously from the fixture provider so a full
 * page of prices renders on the first frame; a live source then replaces those
 * values as its responses arrive.
 *
 * [US-15][US-16]
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Decimal } from '../money/decimal';
import { Money } from '../money/money';
import type { CurrencyCode } from '../money/currency';
import { policyFor, type Instrument } from '../domain/instrument';
import {
  CHART_RANGES,
  FIXTURE_INSTRUMENTS,
  type ChartRange,
  type FixtureInstrument,
  type PricePoint,
} from './fixtures';
import type { ProviderQuote, QuoteProvider } from './quote-provider';
import { FixtureQuoteProvider } from './fixture-quote-provider';
import { YahooQuoteProvider } from './yahoo-quote-provider';
import { DataSourceService } from './data-source.service';

/**
 * An immutable price observation.
 *
 * Carries the observation twice, deliberately:
 *   - `rate` / `previousCloseRate` at the INSTRUMENT'S quoting precision, which
 *     for FX is finer than the currency's minor unit. Use these for display and
 *     for percentage moves.
 *   - `price` / `previousClose` as Money at the CURRENCY'S scale, which is what
 *     cash arithmetic (consideration, balances) must use.
 *
 * Collapsing the two would round GBP/USD 1.34215 to $1.34 and report every
 * intraday FX move as 0.00%.
 */
export interface Quote {
  readonly instrumentId: string;
  readonly currency: CurrencyCode;
  readonly rate: Decimal;
  readonly previousCloseRate: Decimal;
  readonly price: Money;
  readonly observedAt: Date;
  readonly previousClose: Money;
}

export type LiveStatus = 'fixture' | 'loading' | 'live' | 'degraded';

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly fixtures = inject(FixtureQuoteProvider);
  private readonly yahoo = inject(YahooQuoteProvider);
  private readonly source = inject(DataSourceService);

  readonly instruments: readonly Instrument[] = FIXTURE_INSTRUMENTS;
  private readonly universe: readonly FixtureInstrument[] = FIXTURE_INSTRUMENTS;
  private readonly byId = new Map<string, FixtureInstrument>(
    FIXTURE_INSTRUMENTS.map((instrument) => [instrument.id, instrument]),
  );

  private readonly quotes = new Map<string, ProviderQuote>();
  /** Cached history, keyed by source + instrument + range. */
  private readonly seriesCache = new Map<string, PricePoint[]>();
  private readonly pendingHistory = new Set<string>();

  /** Bumped whenever prices change; anything reading a price depends on it. */
  private readonly version = signal(0);
  readonly lastTickAt = signal<Date>(new Date());

  readonly status = signal<LiveStatus>('fixture');
  readonly statusDetail = signal<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Consecutive live-source failures, used to back off. */
  private failures = 0;

  constructor() {
    // Synchronous seed: the first paint must have a price for every instrument.
    this.absorb(this.fixtures.seed(this.universe));

    effect(() => {
      const id = this.source.active();
      // History and synthesised series are source-specific; drop them on switch.
      this.seriesCache.clear();
      this.pendingHistory.clear();
      this.status.set(id === 'fixture' ? 'fixture' : 'loading');
      this.statusDetail.set(null);
      this.restartPolling();
    });
  }

  // ---- Instruments ---------------------------------------------------------

  instrument(instrumentId: string): Instrument | undefined {
    return this.byId.get(instrumentId);
  }

  requireInstrument(instrumentId: string): Instrument {
    const found = this.byId.get(instrumentId);
    if (!found) throw new Error(`Unknown instrument: ${instrumentId}`);
    return found;
  }

  readonly tradeableInstruments = computed(() => this.instruments.filter((i) => i.tradeable));
  readonly ranges = CHART_RANGES;

  // ---- Quotes --------------------------------------------------------------

  /**
   * [US-16] The latest observation for an instrument.
   *
   * Reading this inside a computed or template makes that consumer reactive to
   * every refresh, which is what drives the live prices across the UI.
   */
  latestQuote(instrumentId: string): Quote {
    this.version();
    return this.quoteNow(instrumentId);
  }

  /**
   * [BR-08] The latest quote, read imperatively at execution time.
   *
   * Deliberately does NOT touch the version signal: execution must read the
   * price at the instant it runs, not react to later refreshes.
   */
  quoteForExecution(instrumentId: string): Quote {
    return this.quoteNow(instrumentId);
  }

  // ---- History -------------------------------------------------------------

  /**
   * Price history for a chart.
   *
   * Always returns synchronously. Under a live source the real history is
   * fetched in the background and swapped in when it lands, so a chart never
   * blocks a render or flashes empty.
   */
  series(instrumentId: string, range: ChartRange): readonly PricePoint[] {
    this.version();
    const instrument = this.byId.get(instrumentId);
    const quote = this.quotes.get(instrumentId);
    if (!instrument || !quote) return [];

    const key = `${this.source.active()}:${instrumentId}:${range}`;
    let cached = this.seriesCache.get(key);

    if (!cached) {
      cached = this.fixtures.synthesise(instrument, range, quote.rate);
      this.seriesCache.set(key, cached);
      this.loadHistory(instrument, range, key);
      return cached;
    }

    // Keep history fixed; move only the right-hand edge to the live rate.
    const tail = cached[cached.length - 1];
    if (tail && !tail.price.equals(quote.rate)) {
      cached[cached.length - 1] = { at: new Date(), price: quote.rate };
    }
    return cached;
  }

  /** Compact series for an inline sparkline. */
  sparkline(instrumentId: string): readonly PricePoint[] {
    return this.series(instrumentId, '1D');
  }

  // ---- Display-only FX -----------------------------------------------------

  /**
   * Indicative conversion rate, for DISPLAY aggregation only.
   *
   * The platform holds per-currency balances and never converts at trade time,
   * so this rate is never used to price, validate or settle an order. It exists
   * solely so a client holding GBP, USD and INR can see one portfolio figure.
   */
  indicativeRate(from: CurrencyCode, to: CurrencyCode): Decimal | null {
    this.version();
    if (from === to) return Decimal.parse('1');

    const direct = this.pairRate(from, to);
    if (direct) return direct;

    // Bridge through USD, the quote leg of every pair in the universe.
    const toUsd = from === 'USD' ? Decimal.parse('1') : this.pairRate(from, 'USD');
    const fromUsd = to === 'USD' ? Decimal.parse('1') : this.pairRate('USD', to);
    if (!toUsd || !fromUsd) return null;
    return toUsd.times(fromUsd, 8, 'HALF_EVEN');
  }

  /** Converts for display only. Returns null when no indicative rate exists. */
  convertForDisplay(amount: Money, to: CurrencyCode): Money | null {
    if (amount.currency === to) return amount;
    const rate = this.indicativeRate(amount.currency, to);
    if (!rate) return null;
    return Money.from(amount.amount.timesExact(rate), to, 'HALF_EVEN');
  }

  // ---- Internals -----------------------------------------------------------

  private get provider(): QuoteProvider {
    return this.source.active() === 'yahoo' ? this.yahoo : this.fixtures;
  }

  private quoteNow(instrumentId: string): Quote {
    const quote = this.quotes.get(instrumentId);
    if (!quote) throw new Error(`No market data for instrument: ${instrumentId}`);
    return {
      instrumentId,
      currency: quote.currency,
      rate: quote.rate,
      previousCloseRate: quote.previousClose,
      price: Money.from(quote.rate, quote.currency, 'HALF_EVEN'),
      observedAt: quote.observedAt,
      previousClose: Money.from(quote.previousClose, quote.currency, 'HALF_EVEN'),
    };
  }

  private absorb(incoming: readonly ProviderQuote[]): void {
    for (const quote of incoming) this.quotes.set(quote.instrumentId, quote);
  }

  private pairRate(from: CurrencyCode, to: CurrencyCode): Decimal | null {
    for (const instrument of this.universe) {
      if (instrument.classCode !== 'FX') continue;
      const [base, quote] = instrument.symbol.split('/') as [CurrencyCode, CurrencyCode];
      const rate = this.quotes.get(instrument.id)?.rate;
      if (!rate) continue;
      if (base === from && quote === to) return rate;
      if (base === to && quote === from) return Decimal.parse('1').divide(rate, 8, 'HALF_EVEN');
    }
    return null;
  }

  private restartPolling(): void {
    if (typeof window === 'undefined') return;
    if (this.timer) clearTimeout(this.timer);
    this.failures = 0;
    void this.poll();
  }

  /**
   * Self-rescheduling poll.
   *
   * A plain setInterval would keep hammering a source that is already refusing
   * us. Yahoo throttles by IP and returns 429 — observed in development after
   * only a handful of requests — so repeated failures back off exponentially to
   * a two-minute ceiling instead of making the situation worse.
   */
  private async poll(): Promise<void> {
    const provider = this.provider;
    try {
      const incoming = await provider.refresh(this.universe);
      // A slow response that lands after the source changed is discarded.
      if (provider.id !== this.source.active()) return;

      if (incoming.length > 0) {
        this.absorb(incoming);
        if (provider.id === 'yahoo') {
          this.status.set('live');
          this.statusDetail.set(`${incoming.length} instruments`);
        }
      }
      this.failures = 0;
      this.lastTickAt.set(new Date());
      this.version.update((v) => v + 1);
    } catch (error) {
      if (provider.id !== 'fixture') {
        this.failures += 1;
        // Degrade rather than blank the page: the last good quotes stay on screen.
        this.status.set('degraded');
        this.statusDetail.set(error instanceof Error ? error.message : 'Live feed unavailable');
      }
    } finally {
      if (provider.id === this.source.active()) {
        this.timer = setTimeout(() => void this.poll(), this.nextDelay(provider.pollMs));
      }
    }
  }

  private nextDelay(base: number): number {
    if (this.failures === 0) return base;
    return Math.min(base * 2 ** Math.min(this.failures, 4), 120_000);
  }

  /** Fetches real history in the background and swaps it into the cache. */
  private loadHistory(instrument: FixtureInstrument, range: ChartRange, key: string): void {
    if (this.source.active() === 'fixture' || this.pendingHistory.has(key)) return;
    this.pendingHistory.add(key);

    void this.yahoo
      .history(instrument, range)
      .then((points) => {
        if (points && points.length >= 2 && this.seriesCache.has(key)) {
          this.seriesCache.set(key, [...points]);
          this.version.update((v) => v + 1);
        }
      })
      .catch((error) => {
        // The synthesised series stays; only the upgrade failed.
        console.warn(`[market-data] history unavailable for ${instrument.symbol}:`, error);
      })
      .finally(() => this.pendingHistory.delete(key));
  }
}
