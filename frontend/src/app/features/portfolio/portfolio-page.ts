/**
 * Portfolio dashboard.
 *
 * Combines the PS-03 read models: holdings (US-12), per-currency cash (US-13)
 * and recent order activity (US-14), with live indicative pricing from PS-04
 * (US-15/US-16) driving every figure on the screen.
 *
 * The headline figure is a consolidated total across three currencies. The
 * platform holds per-currency balances and never converts at trade time, so
 * that consolidation is a DISPLAY convenience at indicative rates and the UI
 * says so directly beneath it. See docs/open-questions.md.
 *
 * [US-12][US-13][US-14][US-16]
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Decimal } from '../../core/money/decimal';
import { Money, percentChange } from '../../core/money/money';
import type { CurrencyCode } from '../../core/money/currency';
import { MarketDataService } from '../../core/data/market-data.service';
import { DISPLAY_CURRENCIES, PortfolioService } from '../../core/data/portfolio.service';
import { OrderService } from '../../core/data/order.service';
import { ORDER_STATE_LABELS, stateTone, type OrderState } from '../../core/domain/order';
import { CHART_RANGES, seriesEndingAt, type ChartRange, type PricePoint } from '../../core/data/fixtures';
import { PriceChart } from '../../shared/price-chart';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { HoldingsTable } from './holdings-table';
import { PerformancePanel } from './performance-panel';
import { CashPanel } from './cash-panel';
import { WatchlistRail } from './watchlist-rail';
import { WorkingOrders } from './working-orders';

const RANGE_LABELS: Record<ChartRange, string> = {
  '1D': 'Today',
  '1W': 'Past week',
  '1M': 'Past month',
  '3M': 'Past 3 months',
  '1Y': 'Past year',
  ALL: 'All time',
};

@Component({
  selector: 'leap-portfolio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PriceChart,
    InstrumentLogo,
    HoldingsTable,
    PerformancePanel,
    CashPanel,
    WatchlistRail,
    WorkingOrders,
  ],
  templateUrl: './portfolio-page.html',
  styleUrl: './portfolio-page.scss',
})
export class PortfolioPage {
  private readonly market = inject(MarketDataService);
  protected readonly portfolio = inject(PortfolioService);
  protected readonly orders = inject(OrderService);

  readonly ranges = CHART_RANGES;
  readonly displayCurrencies = DISPLAY_CURRENCIES;
  readonly range = signal<ChartRange>('1D');

  /** Point the pointer is currently over, or null when not scrubbing. */
  readonly scrubbed = signal<PricePoint | null>(null);

  /**
   * Portfolio value history.
   *
   * Synthesised from the live total rather than replayed from stored valuations
   * — there is no valuation history table on the frontend and inventing one
   * would misrepresent what the backend actually records. Cached per range and
   * currency so the line stays stable while its right edge tracks the total.
   */
  private readonly seriesCache = new Map<string, PricePoint[]>();

  readonly series = computed<readonly PricePoint[]>(() => {
    const total = this.portfolio.totalValue();
    const key = `${this.range()}:${total.currency}`;
    let cached = this.seriesCache.get(key);
    if (!cached) {
      // Lower volatility than any single instrument: a diversified book across
      // three currencies and five classes does not swing like one crypto line.
      cached = seriesEndingAt(total.amount, this.range(), 22, `portfolio:${total.currency}`);
      this.seriesCache.set(key, cached);
      return cached;
    }
    const tail = cached[cached.length - 1];
    if (!tail.price.equals(total.amount)) {
      cached[cached.length - 1] = { at: new Date(), price: total.amount };
    }
    return cached;
  });

  /** Headline figure — the scrubbed point when hovering, otherwise the live total. */
  readonly headlineValue = computed<Money>(() => {
    const currency = this.portfolio.displayCurrency();
    const scrubbed = this.scrubbed();
    return scrubbed ? Money.from(scrubbed.price, currency, 'HALF_EVEN') : this.portfolio.totalValue();
  });

  /** Change over the selected range, or from range start to the scrub point. */
  readonly rangeChange = computed<{ money: Money; percent: Decimal }>(() => {
    const currency = this.portfolio.displayCurrency();
    const series = this.series();
    if (series.length < 2) {
      return { money: Money.zero(currency), percent: Decimal.zero(2) };
    }
    const open = Money.from(series[0].price, currency, 'HALF_EVEN');
    const close = this.headlineValue();
    return { money: close.minus(open), percent: percentChange(open, close) };
  });

  readonly rising = computed(() => !this.rangeChange().money.isNegative());

  readonly rangeLabel = computed(() => (this.scrubbed() ? 'At cursor' : RANGE_LABELS[this.range()]));

  readonly holdingsCount = computed(() => this.portfolio.holdings().length);

  readonly recentOrders = computed(() => this.orders.orders().slice(0, 5));

  /** Total unrealised gain — the metric strip's "Unrealized gain" figure. */
  readonly unrealisedGain = computed(() => this.portfolio.totalUnrealisedPnl());

  /** Unrealised P/L as a percentage of book cost — the metric strip's "Total return". */
  readonly totalReturnPercent = computed(() => this.portfolio.totalReturnPercent());

  /** Currencies the account actually holds cash in — never a single balance. */
  readonly currencyCount = computed(() => this.portfolio.cashBalances().length);

  setRange(range: ChartRange): void {
    this.range.set(range);
    this.scrubbed.set(null);
  }

  setDisplayCurrency(currency: CurrencyCode): void {
    this.portfolio.displayCurrency.set(currency);
    this.scrubbed.set(null);
  }

  onScrub(point: PricePoint | null): void {
    this.scrubbed.set(point);
  }

  label(state: OrderState): string {
    return ORDER_STATE_LABELS[state];
  }

  tone(state: OrderState): string {
    return stateTone(state);
  }

  /** Split for the hero figure so the minor units can be rendered smaller. */
  readonly headlineParts = computed(() => {
    const formatted = this.headlineValue().format();
    const dot = formatted.lastIndexOf('.');
    return dot === -1
      ? { major: formatted, minor: '' }
      : { major: formatted.slice(0, dot), minor: formatted.slice(dot) };
  });
}
