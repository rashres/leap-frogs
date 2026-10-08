import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstrumentsService } from '../../core/api/instruments.service';
import { createLoader } from '../../core/api/loader';
import type { OrderStatus, PriceRange } from '../../core/api/models';
import { marketFor } from '../../core/markets/sessions';
import type { ScoredNewsItem } from '../../core/news/news';
import { NewsService } from '../../core/news/news.service';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { formatQty, formatSignedPct, formatSignedUsd, formatStamp, formatPrice, formatTime, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { NewsFeed } from '../../shared/news-feed';
import { PriceChart, type PricePoint } from '../../shared/price-chart';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { OrderTicket } from './order-ticket';

/**
 * One instrument: price, rules, headlines, your orders and position, with the
 * order ticket in the rail. Layout adapted from fe/21-page-mascots
 * (features/instrument). Reads GET /api/instruments/{id}; the market store keeps
 * the price current afterwards.
 */
@Component({
  selector: 'leap-instrument-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, NewsFeed, OrderTicket, PriceChart],
  templateUrl: './instrument-page.html',
  styleUrl: './instrument-page.scss',
})
export class InstrumentPage {
  private readonly api = inject(InstrumentsService);
  private readonly market = inject(MarketStore);
  private readonly portfolio = inject(PortfolioStore);
  private readonly watchlist = inject(WatchlistService);
  protected readonly news = inject(NewsService);

  /** Route parameter, bound by withComponentInputBinding. */
  readonly id = input.required<string>();

  readonly instrumentId = computed(() => Number(this.id()));
  readonly detail = createLoader(() => this.api.get(this.instrumentId()));

  /** The polled list entry when present (fresher price), otherwise the detail response. */
  readonly instrument = computed(() => this.market.instrument(this.instrumentId()) ?? this.detail.data() ?? null);

  readonly notFound = computed(() => !this.instrument() && this.detail.status() === 'error');
  readonly policy = computed(() => {
    const inst = this.instrument();
    return inst ? marketFor(inst.exchange) : null;
  });
  readonly marketOpen = computed(() => this.policy()?.isOpen(this.market.now()) ?? false);
  readonly watched = computed(() => this.watchlist.isWatched(this.instrumentId()));

  readonly ranges: readonly PriceRange[] = ['1D', '1W', '1M', '3M', '1Y'];
  readonly range = signal<PriceRange>('1M');
  readonly history = createLoader(() => this.api.prices(this.instrumentId(), this.range()));
  readonly scrubbed = signal<PricePoint | null>(null);

  /** Recorded prices for the range, ending at the live price when it is newer. */
  readonly series = computed<readonly PricePoint[]>(() => {
    const points = (this.history.data() ?? []).map((p) => ({ at: new Date(p.observedAt), price: p.price }));
    const inst = this.instrument();
    if (inst?.lastPrice != null && inst.priceUpdatedAt) {
      const at = new Date(inst.priceUpdatedAt);
      if (!points.length || at > points[points.length - 1].at) points.push({ at, price: inst.lastPrice });
    }
    return points;
  });

  /** Change across the range, measured to the scrubbed point while hovering. */
  readonly rangeChange = computed(() => {
    const series = this.series();
    if (series.length < 2) return null;
    const open = series[0].price;
    const end = this.scrubbed()?.price ?? series[series.length - 1].price;
    const delta = end - open;
    const deltaText = `${delta < 0 ? '−' : '+'}${formatPrice(Math.abs(delta), open)}`;
    return { deltaText, percentText: formatSignedPct((delta / open) * 100), negative: delta < 0 };
  });
  readonly rising = computed(() => !(this.rangeChange()?.negative ?? false));

  readonly rangeBounds = computed(() => {
    const prices = this.series().map((p) => p.price);
    return prices.length ? { low: formatPrice(Math.min(...prices)), high: formatPrice(Math.max(...prices)) } : null;
  });

  readonly priceText = computed(() => formatPrice(this.scrubbed()?.price ?? this.instrument()?.lastPrice));
  readonly lastPriceText = computed(() => formatPrice(this.instrument()?.lastPrice));
  readonly updatedText = computed(() => {
    const at = this.instrument()?.priceUpdatedAt;
    return at ? formatTime(at) : null;
  });
  readonly updatedStamp = computed(() => formatStamp(this.instrument()?.priceUpdatedAt));

  readonly orders = computed(() =>
    this.portfolio.ordersFor(this.instrumentId()).map((o) => ({
      id: o.orderId,
      side: o.side,
      quantity: formatQty(o.quantity),
      label: ORDER_STATUS_LABELS[o.status],
      tone: statusTone(o.status as OrderStatus),
      fill: o.status === 'COMPLETE' ? `at ${formatPrice(o.price)}` : 'not filled',
      when: formatTime(o.placedTime),
    })),
  );

  readonly position = computed(() => {
    const p = this.portfolio.position(this.instrumentId());
    if (!p) return null;
    return {
      quantity: formatQty(p.quantity),
      averageCost: formatPrice(p.averageCost),
      marketValue: formatUsd(p.marketValue),
      pnl: p.unrealisedPnl != null ? `${formatSignedUsd(p.unrealisedPnl)} (${formatSignedPct(p.unrealisedPnlPercent)})` : '—',
      negative: (p.unrealisedPnl ?? 0) < 0,
    };
  });

  readonly headlines = signal<readonly ScoredNewsItem[]>([]);

  /** NewsAPI title search finds little for a crypto ticker, so search those by name. */
  private readonly newsQuery = computed(() => {
    const inst = this.instrument();
    if (!inst) return null;
    return this.policy()?.code === 'CRYPTO' ? inst.name : inst.symbol;
  });

  constructor() {
    effect(() => {
      this.instrumentId();
      untracked(() => this.detail.reload());
    });

    effect(() => {
      this.instrumentId();
      this.range();
      untracked(() => {
        this.scrubbed.set(null);
        this.history.reload();
      });
    });
    const refresh = setInterval(() => this.history.reload(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(refresh));

    effect(() => {
      const query = this.newsQuery();
      if (!query) return;
      untracked(() => {
        this.headlines.set([]);
        void this.news.forSymbol(query).then((items) => {
          if (this.newsQuery() === query) this.headlines.set(items);
        });
      });
    });
  }

  setRange(range: PriceRange): void {
    this.range.set(range);
  }

  toggleWatch(): void {
    this.watchlist.toggle(this.instrumentId());
  }
}
