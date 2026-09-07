/**
 * Headlines, scored on arrival and filed against the main stocks.
 *
 * The pipeline, in order, is: fetch from a provider → score each headline
 * against the word list → attribute it to instruments by name → roll the
 * attributed set up per stock. Each stage is a pure function that can be tested
 * on its own, and each one shows its working in the UI. Nothing in the chain
 * invents a number.
 *
 * SOURCES. NewsAPI.org is primary because its title search and publisher
 * allowlist give attribution something clean to work with. Yahoo Finance search
 * is the fallback for the two failures that are certain to happen in a demo —
 * no key configured, and the daily request allowance spent. Which source
 * answered is recorded and displayed; the reader is never left guessing whether
 * the feed is live.
 *
 * Failures degrade to an honest empty state. There are no fixture headlines
 * here or anywhere else in this codebase.
 *
 * CACHING. Fifteen minutes, and concurrent callers share one request. The news
 * plan in use allows 100 requests a day; a page that re-fetched on every
 * navigation would spend that before lunch.
 *
 * [4.1]
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AttributedNewsItem,
  NewsItem,
  NewsSourceId,
  ScoredNewsItem,
  StockSentiment,
} from '../domain/news';
import { buildBoard, scoreItem } from './sentiment';
import { attributeAll, coveredInstruments } from './news-attribution';
import { NewsUnavailable, type NewsProvider } from './news-provider';
import { NewsApiProvider } from './newsapi-news-provider';
import { YahooNewsProvider } from './yahoo-news-provider';

const CACHE_MS = 15 * 60 * 1000;

/** How many headlines a sweep asks for. One request, so ask generously. */
const SWEEP_SIZE = 100;

export type FeedState = 'idle' | 'loading' | 'ready' | 'unavailable';

interface CacheEntry {
  readonly at: number;
  readonly items: readonly ScoredNewsItem[];
  readonly source: NewsSourceId;
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly primary = inject(NewsApiProvider);
  private readonly fallback = inject(YahooNewsProvider);

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<readonly ScoredNewsItem[]>>();

  readonly state = signal<FeedState>('idle');
  readonly error = signal<string | null>(null);

  /** Which provider served the most recent successful load. */
  readonly servedBy = signal<NewsSourceId | null>(null);
  /** Set when the primary source failed and the fallback answered instead. */
  readonly fellBackBecause = signal<string | null>(null);

  /** The instruments the stock board covers. */
  readonly covered = coveredInstruments();

  private readonly sweepItems = signal<readonly AttributedNewsItem[]>([]);

  /** Headline sentiment per main stock. Empty until a sweep has run. */
  readonly board = computed<readonly StockSentiment[]>(() =>
    buildBoard(this.sweepItems(), this.covered),
  );

  /** Every attributed headline from the last sweep, newest first. */
  readonly sweepHeadlines = computed(() => this.sweepItems());

  /** Headlines for one instrument, keyed by its ticker or name. */
  forSymbol(symbol: string, count = 8): Promise<readonly ScoredNewsItem[]> {
    return this.load(`symbol:${symbol}`, (provider) => provider.search(symbol, count));
  }

  /**
   * One pass over the main stocks, attributed and rolled up.
   *
   * Returns the attributed headlines; the per-stock roll-up is on `board()`.
   */
  async sweepMainStocks(force = false): Promise<readonly AttributedNewsItem[]> {
    // An explicit Refresh means the reader wants a new request, not the copy
    // they are already looking at. Every other caller stays behind the cache.
    if (force) this.cache.delete('board');
    const items = await this.load('board', (provider) => provider.sweep(SWEEP_SIZE));
    const attributed = attributeAll(items);
    this.sweepItems.set(attributed);
    return attributed;
  }

  cached(key: string): readonly ScoredNewsItem[] | null {
    const hit = this.cache.get(key);
    return hit && Date.now() - hit.at < CACHE_MS ? hit.items : null;
  }

  private load(
    key: string,
    ask: (provider: NewsProvider) => Promise<readonly NewsItem[]>,
  ): Promise<readonly ScoredNewsItem[]> {
    const fresh = this.cache.get(key);
    if (fresh && Date.now() - fresh.at < CACHE_MS) {
      this.state.set('ready');
      this.servedBy.set(fresh.source);
      return Promise.resolve(fresh.items);
    }

    // Collapse concurrent requests for the same key into one fetch.
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    this.state.set('loading');
    this.error.set(null);

    const request = (async () => {
      let primaryFailure: string | null = null;

      for (const provider of [this.primary, this.fallback]) {
        try {
          const items = (await ask(provider)).map(scoreItem);

          // Empty is not an error, but from the primary it is worth a second
          // look: its title search finds nothing for an FX pair or a crypto
          // ticker, which the keyless feed covers well. Trying the fallback
          // costs one request and is the difference between a populated
          // instrument page and a blank one.
          if (items.length === 0 && provider === this.primary) {
            primaryFailure = null;
            continue;
          }

          this.cache.set(key, { at: Date.now(), items, source: provider.id });
          this.state.set('ready');
          this.servedBy.set(provider.id);
          // A fallback that answered because the primary merely had nothing to
          // say is not a degraded state and is not announced as one.
          this.fellBackBecause.set(provider === this.primary ? null : primaryFailure);
          return items;
        } catch (cause) {
          const message =
            cause instanceof NewsUnavailable
              ? cause.message
              : 'Headlines are unavailable from this source.';
          if (provider === this.primary) primaryFailure = message;
          else {
            // Both sources are down. The primary's reason is the useful one:
            // it is the one a missing key or a spent allowance shows up in.
            this.state.set('unavailable');
            this.error.set(primaryFailure ?? message);
            this.servedBy.set(null);
            this.fellBackBecause.set(null);
          }
        }
      }
      return [];
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }
}
