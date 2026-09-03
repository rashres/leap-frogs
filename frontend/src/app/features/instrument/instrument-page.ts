/**
 * Instrument detail: pricing, class rules, position, and the order ticket.
 *
 * The "Class rules" block is rendered straight from the InstrumentClassPolicy
 * that pre-trade validation consults, so what a client is told about precision,
 * settlement currency and trading hours cannot drift from what the validator
 * actually enforces.
 *
 * [US-05][US-06][US-07][US-12][US-15][US-16]
 */

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Decimal } from '../../core/money/decimal';
import { formatRate, formatRateSigned, percentChangeOf } from '../../core/money/money';
import { isMarketOpenFor, policyFor } from '../../core/domain/instrument';
import { ORDER_STATE_LABELS, stateTone, type OrderState, type QuoteSnapshot } from '../../core/domain/order';
import { MarketDataService } from '../../core/data/market-data.service';
import { PortfolioService } from '../../core/data/portfolio.service';
import { OrderService } from '../../core/data/order.service';
import { WatchlistService } from '../../core/data/watchlist.service';
import { CHART_RANGES, type ChartRange, type PricePoint } from '../../core/data/fixtures';
import { NewsService } from '../../core/data/news.service';
import type { ScoredNewsItem } from '../../core/domain/news';
import { PriceChart } from '../../shared/price-chart';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { NewsFeed } from '../../shared/news-feed';
import { OrderTicket } from './order-ticket';

@Component({
  selector: 'leap-instrument-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PriceChart, OrderTicket, InstrumentLogo, NewsFeed],
  templateUrl: './instrument-page.html',
  styleUrl: './instrument-page.scss',
})
export class InstrumentPage {
  private readonly market = inject(MarketDataService);
  private readonly portfolio = inject(PortfolioService);
  private readonly orderService = inject(OrderService);
  private readonly watchlist = inject(WatchlistService);
  protected readonly news = inject(NewsService);

  /** Bound from the :id route parameter. */
  readonly id = input.required<string>();

  readonly ranges = CHART_RANGES;
  readonly range = signal<ChartRange>('1D');
  readonly scrubbed = signal<PricePoint | null>(null);

  readonly instrument = computed(() => this.market.instrument(this.id()) ?? null);

  // ---- Headlines [4.1] -----------------------------------------------------

  readonly headlines = signal<readonly ScoredNewsItem[]>([]);

  /**
   * A ticker is the best search term for equities and crypto, but "GBP/USD"
   * is a poor query, so FX searches on its full name instead.
   */
  private readonly newsQuery = computed(() => {
    const instrument = this.instrument();
    if (!instrument) return null;
    return instrument.classCode === 'FX' ? instrument.name : instrument.symbol;
  });

  constructor() {
    effect(() => {
      const query = this.newsQuery();
      this.headlines.set([]);
      if (query) void this.news.forSymbol(query).then((items) => this.headlines.set(items));
    });
  }

  readonly policy = computed(() => {
    const instrument = this.instrument();
    return instrument ? policyFor(instrument.classCode) : null;
  });

  readonly quote = computed(() => {
    const instrument = this.instrument();
    return instrument ? this.market.latestQuote(instrument.id) : null;
  });

  readonly series = computed<readonly PricePoint[]>(() => {
    const instrument = this.instrument();
    return instrument ? this.market.series(instrument.id, this.range()) : [];
  });

  readonly marketOpen = computed(() => {
    this.market.lastTickAt();
    const instrument = this.instrument();
    return instrument ? isMarketOpenFor(instrument) : false;
  });

  readonly watched = computed(() => {
    const instrument = this.instrument();
    return instrument ? this.watchlist.isWatched(instrument.id) : false;
  });

  /**
   * Headline price — the scrubbed point while hovering, otherwise live.
   *
   * Held as a raw rate at the instrument's quoting precision, not as Money, so
   * an FX pair shows 1.34215 rather than a currency-scaled $1.34.
   */
  readonly headlineRate = computed<Decimal | null>(() => {
    const quote = this.quote();
    if (!quote) return null;
    return this.scrubbed()?.price ?? quote.rate;
  });

  readonly headlineText = computed(() => {
    const rate = this.headlineRate();
    const instrument = this.instrument();
    return rate && instrument ? formatRate(rate, instrument.currency) : '';
  });

  /** Change over the visible range, matching what the chart shows. */
  readonly rangeChange = computed<{ deltaText: string; percent: Decimal; negative: boolean } | null>(() => {
    const instrument = this.instrument();
    const series = this.series();
    const headline = this.headlineRate();
    if (!instrument || !headline || series.length < 2) return null;
    const open = series[0].price;
    const delta = headline.minus(open);
    return {
      deltaText: formatRateSigned(delta, instrument.currency),
      percent: percentChangeOf(open, headline),
      negative: delta.isNegative(),
    };
  });

  readonly rising = computed(() => !(this.rangeChange()?.negative ?? false));

  readonly previousCloseText = computed(() => {
    const quote = this.quote();
    const instrument = this.instrument();
    return quote && instrument ? formatRate(quote.previousCloseRate, instrument.currency) : '';
  });

  /** Low and high across the visible range, at quoting precision. */
  readonly rangeBounds = computed(() => {
    const instrument = this.instrument();
    const series = this.series();
    if (!instrument || series.length === 0) return null;
    let low = series[0].price;
    let high = series[0].price;
    for (const point of series) {
      if (point.price.lessThan(low)) low = point.price;
      if (point.price.greaterThan(high)) high = point.price;
    }
    return {
      low: formatRate(low, instrument.currency),
      high: formatRate(high, instrument.currency),
    };
  });

  readonly position = computed(() => {
    const instrument = this.instrument();
    if (!instrument) return null;
    return this.portfolio.holdings().find((holding) => holding.instrumentId === instrument.id) ?? null;
  });

  readonly orders = computed(() => {
    const instrument = this.instrument();
    return instrument ? this.orderService.ordersFor(instrument.id) : [];
  });

  readonly precisionLabel = computed(() => {
    const policy = this.policy();
    if (!policy) return '';
    return policy.quantityScale === 0
      ? 'Whole units only'
      : `Up to ${policy.quantityScale} decimal places`;
  });

  setRange(range: ChartRange): void {
    this.range.set(range);
    this.scrubbed.set(null);
  }

  onScrub(point: PricePoint | null): void {
    this.scrubbed.set(point);
  }

  toggleWatch(): void {
    const instrument = this.instrument();
    if (instrument) this.watchlist.toggle(instrument.id);
  }

  cancel(orderId: string): void {
    this.orderService.cancel(orderId);
  }

  /** Formats a recorded quote at the instrument's quoting precision. */
  rateText(snapshot: QuoteSnapshot): string {
    const instrument = this.instrument();
    return instrument ? formatRate(snapshot.rate, instrument.currency) : '';
  }

  label(state: OrderState): string {
    return ORDER_STATE_LABELS[state];
  }

  tone(state: OrderState): string {
    return stateTone(state);
  }
}
