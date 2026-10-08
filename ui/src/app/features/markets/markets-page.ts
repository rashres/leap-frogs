import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MARKET_ORDER, MARKETS, marketFor, type MarketCode } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

interface LiveSearchResult {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly type: string;
}

const OTHER: string = 'OTHER';

/**
 * Every instrument from GET /api/instruments, grouped by market. Layout from the
 * team's Angular app (fe/21-page-mascots, features/markets).
 */
@Component({
  selector: 'leap-markets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice, PageHeader, Icon],
  templateUrl: './markets-page.html',
  styleUrl: './markets-page.scss',
})
export class MarketsPage {
  protected readonly market = inject(MarketStore);
  private readonly watchlist = inject(WatchlistService);

  readonly query = signal('');
  readonly marketFilter = signal<string>('');
  readonly exchange = signal<string>('');

  readonly marketOptions = computed(() => {
    const present = new Set<string>(this.market.instruments().map((i) => marketFor(i.exchange)?.code ?? OTHER));
    return [...MARKET_ORDER, OTHER]
      .filter((code) => present.has(code))
      .map((code) => ({ code, label: code === OTHER ? 'Other' : MARKETS[code as MarketCode].label }));
  });

  readonly exchanges = computed(() => [...new Set(this.market.instruments().map((i) => i.exchange))].sort());

  readonly hasActiveFilters = computed(() => Boolean(this.marketFilter()) || Boolean(this.exchange()));

  readonly groups = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const now = this.market.now();
    const matching = this.market
      .instruments()
      .filter(
        (i) =>
          (!needle || i.symbol.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle)) &&
          (!this.marketFilter() || (marketFor(i.exchange)?.code ?? OTHER) === this.marketFilter()) &&
          (!this.exchange() || i.exchange === this.exchange()),
      );

    const byMarket = new Map<string, typeof matching>();
    for (const instrument of matching) {
      const code = marketFor(instrument.exchange)?.code ?? OTHER;
      byMarket.set(code, [...(byMarket.get(code) ?? []), instrument]);
    }

    return [...MARKET_ORDER, OTHER]
      .filter((code) => byMarket.has(code))
      .map((code) => {
        const policy = code === OTHER ? null : MARKETS[code as MarketCode];
        const instruments = byMarket.get(code)!;
        return {
          code,
          label: policy?.label ?? 'Other markets',
          hours: policy?.sessionLabel ?? 'Trading hours not known',
          open: policy ? policy.isOpen(now) : null,
          exchanges: [...new Set(instruments.map((i) => i.exchange))].join(' · '),
          rows: instruments.map((i) => ({
            id: i.instrumentId,
            symbol: i.symbol,
            name: i.name,
            exchange: i.exchange,
            price: i.lastPrice ?? null,
            updated: i.priceUpdatedAt ? ago(now, Date.parse(i.priceUpdatedAt)) : null,
            watched: this.watchlist.isWatched(i.instrumentId),
          })),
        };
      });
  });

  readonly resultCount = computed(() => this.groups().reduce((total, group) => total + group.rows.length, 0));

  /** Yahoo Finance matches, fetched only when nothing in the database matches. */
  readonly liveResults = signal<readonly LiveSearchResult[]>([]);
  readonly liveSearchState = signal<'idle' | 'loading' | 'error'>('idle');
  private liveSearchToken = 0;

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.liveResults.set([]);
    this.liveSearchState.set('idle');

    const needle = value.trim();
    if (needle.length < 2 || this.resultCount() > 0) return;

    const token = ++this.liveSearchToken;
    this.liveSearchState.set('loading');
    yahooSearch(needle)
      .then((results) => {
        if (token !== this.liveSearchToken) return;
        this.liveResults.set(results);
        this.liveSearchState.set('idle');
      })
      .catch(() => {
        if (token !== this.liveSearchToken) return;
        this.liveSearchState.set('error');
      });
  }

  onMarket(event: Event): void {
    this.marketFilter.set((event.target as HTMLSelectElement).value);
  }

  onExchange(event: Event): void {
    this.exchange.set((event.target as HTMLSelectElement).value);
  }

  clearFilters(): void {
    this.marketFilter.set('');
    this.exchange.set('');
  }

  toggleWatch(event: Event, instrumentId: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.watchlist.toggle(instrumentId);
  }
}

function ago(now: Date, at: number): string {
  const seconds = Math.max(0, Math.round((now.getTime() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

async function yahooSearch(term: string): Promise<LiveSearchResult[]> {
  const response = await fetch(
    `/api/yahoo/v1/finance/search?q=${encodeURIComponent(term)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as {
    quotes?: { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; typeDisp?: string }[];
  };
  return (body.quotes ?? [])
    .filter((q) => q.symbol)
    .map((q) => ({
      symbol: q.symbol!,
      name: q.longname ?? q.shortname ?? q.symbol!,
      exchange: q.exchDisp ?? '—',
      type: q.typeDisp ?? 'Unknown',
    }));
}
