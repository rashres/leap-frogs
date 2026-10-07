import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstrumentsService } from '../../core/api/instruments.service';
import { createLoader } from '../../core/api/loader';
import type { OrderStatus } from '../../core/api/models';
import { marketFor } from '../../core/markets/sessions';
import type { ScoredNewsItem } from '../../core/news/news';
import { NewsService } from '../../core/news/news.service';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { formatQty, formatSignedPct, formatSignedUsd, formatStamp, formatTime, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { NewsFeed } from '../../shared/news-feed';
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
  imports: [RouterLink, InstrumentLogo, NewsFeed, OrderTicket],
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

  readonly priceText = computed(() => formatUsd(this.instrument()?.lastPrice));
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
      fill: o.status === 'COMPLETE' ? `at ${formatUsd(o.price)}` : 'not filled',
      when: formatTime(o.placedTime),
    })),
  );

  readonly position = computed(() => {
    const p = this.portfolio.position(this.instrumentId());
    if (!p) return null;
    return {
      quantity: formatQty(p.quantity),
      averageCost: formatUsd(p.averageCost),
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

  toggleWatch(): void {
    this.watchlist.toggle(this.instrumentId());
  }
}
