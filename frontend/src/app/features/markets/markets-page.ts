/**
 * Market browser, grouped by instrument class.
 *
 * The grouping is not cosmetic. CLAUDE.md requires the five classes to be
 * modelled as separate strategies because settlement currency, quantity
 * precision, fractional permission and trading hours all differ between them —
 * so each group states its own rules in its header, and those strings come from
 * the same policy objects pre-trade validation reads.
 *
 * [US-15][US-16]
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/data/market-data.service';
import { WatchlistService } from '../../core/data/watchlist.service';
import { percentChangeOf } from '../../core/money/money';
import {
  INSTRUMENT_CLASS_POLICIES,
  policyFor,
  type InstrumentClassCode,
} from '../../core/domain/instrument';
import { instrumentClassOrder } from '../../core/data/fixtures';
import type { CurrencyCode } from '../../core/money/currency';
import { Sparkline } from '../../shared/sparkline';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';
import { MoversStrip } from './movers-strip';
import { YahooQuoteProvider, type LiveSearchResult } from '../../core/data/yahoo-quote-provider';

@Component({
  selector: 'leap-markets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Sparkline, InstrumentLogo, LivePrice, MoversStrip],
  templateUrl: './markets-page.html',
  styleUrl: './markets-page.scss',
})
export class MarketsPage {
  private readonly market = inject(MarketDataService);
  private readonly watchlist = inject(WatchlistService);
  private readonly yahoo = inject(YahooQuoteProvider);

  readonly query = signal('');

  /** Asset-class filter; '' means every class. */
  readonly assetClass = signal<InstrumentClassCode | ''>('');
  /** Exchange filter; '' means every exchange. */
  readonly exchange = signal<string>('');
  /** Settlement-currency filter; '' means every currency. */
  readonly currency = signal<CurrencyCode | ''>('');

  /** Asset classes present in the local universe, in display order. */
  readonly assetClasses = computed(() => {
    const seen = new Set(this.market.instruments.map((i) => i.classCode));
    return [...seen]
      .sort((a, b) => instrumentClassOrder(a) - instrumentClassOrder(b))
      .map((code) => ({ code, label: INSTRUMENT_CLASS_POLICIES[code].label }));
  });

  /** Exchanges present in the local universe, alphabetical. */
  readonly exchanges = computed(() =>
    [...new Set(this.market.instruments.map((i) => i.exchange))].sort(),
  );

  /** Settlement currencies present in the local universe, alphabetical. */
  readonly currencies = computed(() =>
    [...new Set(this.market.instruments.map((i) => i.currency))].sort(),
  );

  readonly hasActiveFilters = computed(
    () => Boolean(this.assetClass()) || Boolean(this.exchange()) || Boolean(this.currency()),
  );

  readonly groups = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const assetClass = this.assetClass();
    const exchange = this.exchange();
    const currency = this.currency();

    const matching = this.market.instruments.filter(
      (instrument) =>
        (!needle ||
          instrument.symbol.toLowerCase().includes(needle) ||
          instrument.name.toLowerCase().includes(needle)) &&
        (!assetClass || instrument.classCode === assetClass) &&
        (!exchange || instrument.exchange === exchange) &&
        (!currency || instrument.currency === currency),
    );

    const byClass = new Map<InstrumentClassCode, typeof matching>();
    for (const instrument of matching) {
      const bucket = byClass.get(instrument.classCode) ?? [];
      bucket.push(instrument);
      byClass.set(instrument.classCode, bucket);
    }

    return [...byClass.entries()]
      .sort(([a], [b]) => instrumentClassOrder(a) - instrumentClassOrder(b))
      .map(([code, instruments]) => {
        const policy = INSTRUMENT_CLASS_POLICIES[code];
        return {
          code,
          label: policy.label,
          hours: policy.sessionLabel,
          open: policy.isMarketOpen(this.market.lastTickAt()),
          settlement: policy.settlementCurrency,
          precision:
            policy.quantityScale === 0
              ? 'Whole units only'
              : `${policy.quantityScale}dp · fractional allowed`,
          rows: instruments.map((instrument) => {
            const quote = this.market.latestQuote(instrument.id);
            // Quoted rates, so FX shows its true 5dp move rather than $0.00.
            const change = percentChangeOf(quote.previousCloseRate, quote.rate);
            return {
              id: instrument.id,
              symbol: instrument.symbol,
              name: instrument.name,
              exchange: instrument.exchange,
              tradeable: instrument.tradeable,
              suspensionNote: instrument.suspensionNote,
              rate: quote.rate,
              currency: instrument.currency,
              change: change.abs().toString(),
              negative: change.isNegative(),
              spark: this.market.sparkline(instrument.id),
              watched: this.watchlist.isWatched(instrument.id),
              scale: policyFor(instrument.classCode).priceScale,
            };
          }),
        };
      });
  });

  readonly resultCount = computed(() => this.groups().reduce((total, group) => total + group.rows.length, 0));

  /**
   * Live matches from Yahoo Finance, for a symbol this app has no fixture for.
   * Fetched only once the local universe has nothing left to show, so a normal
   * search of the built-in instruments never touches the network.
   */
  readonly liveResults = signal<readonly LiveSearchResult[]>([]);
  readonly liveSearchState = signal<'idle' | 'loading' | 'error'>('idle');
  private liveSearchToken = 0;

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.liveResults.set([]);
    this.liveSearchState.set('idle');

    const needle = value.trim();
    if (needle.length < 2) return;

    const token = ++this.liveSearchToken;
    // Only worth a live lookup once the local universe has no matches at all.
    if (this.resultCount() > 0) return;

    this.liveSearchState.set('loading');
    this.yahoo
      .search(needle)
      .then((results) => {
        if (token !== this.liveSearchToken) return; // a newer keystroke superseded this request
        this.liveResults.set(results);
        this.liveSearchState.set('idle');
      })
      .catch(() => {
        if (token !== this.liveSearchToken) return;
        this.liveSearchState.set('error');
      });
  }

  onAssetClass(event: Event): void {
    this.assetClass.set((event.target as HTMLSelectElement).value as InstrumentClassCode | '');
  }

  onExchange(event: Event): void {
    this.exchange.set((event.target as HTMLSelectElement).value);
  }

  onCurrency(event: Event): void {
    this.currency.set((event.target as HTMLSelectElement).value as CurrencyCode | '');
  }

  clearFilters(): void {
    this.assetClass.set('');
    this.exchange.set('');
    this.currency.set('');
  }

  toggleWatch(event: Event, instrumentId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.watchlist.toggle(instrumentId);
  }
}

