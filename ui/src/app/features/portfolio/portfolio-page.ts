import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatSignedPct, formatSignedUsd, formatTime, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { HoldingsTable } from './holdings-table';
import { ValueChartPanel } from './value-chart-panel';
import { WatchlistRail } from './watchlist-rail';
import { DayChangeStore } from './day-change.store';
import { ExchangePanel } from './exchange-panel';
import { MarketOverview } from './market-overview';
import { TickerBelt } from './ticker-belt';
import { LastTransactions } from './last-transactions';
import { MarketNews } from './market-news';

/**
 * Portfolio dashboard for the active account. Layout from the team's Angular
 * app (fe/21-page-mascots, features/portfolio); every figure comes from the API:
 * cash and holdings from /accounts/{id}, valuations from instrument lastPrice,
 * average cost from the account's completed orders.
 */
@Component({
  selector: 'leap-portfolio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ValueChartPanel, HoldingsTable, WatchlistRail, PageHeader, Icon, TickerBelt, ExchangePanel, MarketOverview, LastTransactions, MarketNews],
  providers: [DayChangeStore],
  templateUrl: './portfolio-page.html',
  styleUrl: './portfolio-page.scss',
  host: {
    '(document:keydown.escape)': 'cashOpen.set(false)',
    '(document:click)': 'closeCash($event)',
  },
})
export class PortfolioPage {
  protected readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);

  readonly cashOpen = signal(false);

  readonly rising = computed(() => this.portfolio.totalUnrealisedPnl() >= 0);

  readonly pnlText = computed(() => formatSignedUsd(this.portfolio.totalUnrealisedPnl()));
  readonly returnText = computed(() => formatSignedPct(this.portfolio.totalReturnPercent()));
  readonly cashText = computed(() => formatUsd(this.portfolio.cash()));
  readonly investedText = computed(() => formatUsd(this.portfolio.marketValue()));
  readonly totalText = computed(() => formatUsd(this.portfolio.totalValue()));

  /** Markets this cash can buy, from the exchanges in the database. */
  readonly buyableMarkets = computed(() => {
    const labels = new Set(this.market.instruments().map((i) => marketFor(i.exchange)?.shortLabel ?? i.exchange));
    return [...labels].join(' · ') || 'no markets yet';
  });

  readonly priceNote = computed(() => {
    const updated = this.market.lastPriceUpdate();
    const unpriced = this.portfolio.unpricedCount();
    const base = updated
      ? `Valued at the latest price from the price feed (updated ${formatTime(updated)}).`
      : 'No instrument has a price yet, so holdings are not valued.';
    return unpriced > 0 ? `${base} ${unpriced} holding${unpriced === 1 ? ' has' : 's have'} no price and ${unpriced === 1 ? 'is' : 'are'} excluded.` : base;
  });

  closeCash(event: MouseEvent): void {
    if (this.cashOpen() && !(event.target as HTMLElement).closest('.cash-metric')) {
      this.cashOpen.set(false);
    }
  }
}
