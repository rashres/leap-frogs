import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { OrderStatus } from '../../core/api/models';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatSignedPct, formatSignedUsd, formatTime, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { CashPanel } from './cash-panel';
import { HoldingsTable } from './holdings-table';
import { PerformancePanel } from './performance-panel';
import { ValueChartPanel } from './value-chart-panel';
import { WatchlistRail } from './watchlist-rail';

/**
 * Portfolio dashboard for the active account. Layout from the team's Angular
 * app (fe/21-page-mascots, features/portfolio); every figure comes from the API:
 * cash and holdings from /accounts/{id}, valuations from instrument lastPrice,
 * average cost from the account's completed orders.
 */
@Component({
  selector: 'leap-portfolio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, ValueChartPanel, HoldingsTable, PerformancePanel, CashPanel, WatchlistRail, PageHeader, Icon],
  templateUrl: './portfolio-page.html',
  styleUrl: './portfolio-page.scss',
})
export class PortfolioPage {
  protected readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);

  readonly rising = computed(() => this.portfolio.totalUnrealisedPnl() >= 0);

  readonly headlineParts = computed(() => {
    const formatted = formatUsd(this.portfolio.totalValue());
    const dot = formatted.lastIndexOf('.');
    return dot === -1 ? { major: formatted, minor: '' } : { major: formatted.slice(0, dot), minor: formatted.slice(dot) };
  });

  readonly pnlText = computed(() => formatSignedUsd(this.portfolio.totalUnrealisedPnl()));
  readonly returnText = computed(() => formatSignedPct(this.portfolio.totalReturnPercent()));
  readonly cashText = computed(() => formatUsd(this.portfolio.cash()));

  readonly initials = computed(() =>
    (this.portfolio.account.active()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );

  readonly recentOrders = computed(() =>
    this.portfolio
      .orderList()
      .slice(0, 5)
      .map((o) => ({ ...o, qtyText: formatQty(o.quantity), when: formatTime(o.placedTime) })),
  );

  readonly priceNote = computed(() => {
    const updated = this.market.lastPriceUpdate();
    const unpriced = this.portfolio.unpricedCount();
    const base = updated
      ? `Valued at the latest price from the price feed (updated ${formatTime(updated)}).`
      : 'No instrument has a price yet, so holdings are not valued.';
    return unpriced > 0 ? `${base} ${unpriced} holding${unpriced === 1 ? ' has' : 's have'} no price and ${unpriced === 1 ? 'is' : 'are'} excluded.` : base;
  });

  label(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status];
  }

  tone(status: OrderStatus): string {
    return statusTone(status);
  }
}
