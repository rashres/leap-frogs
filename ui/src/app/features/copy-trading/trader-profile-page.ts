import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsService } from '../../core/api/accounts.service';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import { createLoader } from '../../core/api/loader';
import type { PriceRange } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { IntradayService, portfolioIntraday, type IntradaySeries } from '../../core/markets/intraday.service';
import { marketFor } from '../../core/markets/sessions';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { MarketStore } from '../../core/state/market.store';
import { costBasis } from '../../core/state/portfolio.store';
import { formatPrice, formatQty, formatSignedPct, formatSignedUsd, formatStamp, formatUsd } from '../../shared/format';
import { AllocationDonut, type DonutSegment } from '../../shared/allocation-donut';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { PriceChart, type PricePoint } from '../../shared/price-chart';
import { CopyControl } from './copy-control';
import { equitySeries, initials, riskLabel, riskTone, signTone, since, traderMetrics } from './trader-view';

type TradeFilter = 'ALL' | 'BUY' | 'SELL';

/** Trades shown before "Show all". */
const TRADES_SHOWN = 12;

/** How often the live 1D line asks for new minutes; the API caches them for 10 seconds. */
const LIVE_REFRESH_MS = 15_000;

/** Donut slice colours, in fixed order. Past four holdings the rest fold into "Other". */
const SLICE_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

/**
 * One lead trader: performance (equity curve and every headline metric),
 * their current portfolio, and their full trade history. Route /copy-trading/:id.
 * 1D is live, the same way as the portfolio chart.
 */
@Component({
  selector: 'leap-trader-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, InstrumentLogo, PriceChart, CopyControl, AllocationDonut],
  templateUrl: './trader-profile-page.html',
  styleUrl: './trader-profile-page.scss',
})
export class TraderProfilePage {
  private readonly api = inject(CopyTradingService);
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  private readonly market = inject(MarketStore);
  private readonly intraday = inject(IntradayService);
  protected readonly account = inject(ActiveAccountService);

  /** From the route, via withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly traderId = computed(() => Number(this.id()));

  readonly trader = createLoader(() => this.api.trader(this.traderId()));
  readonly trades = createLoader(() => this.api.traderOrders(this.traderId()));
  readonly holdings = createLoader(() => this.accountsApi.holdings(this.trader.data()!.accountId));
  readonly subscriptions = createLoader(() => this.api.subscriptions(this.account.activeId()!));
  readonly history = createLoader(() => this.accountsApi.valueHistory(this.trader.data()!.accountId, this.range()));

  readonly ranges: readonly PriceRange[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];
  readonly range = signal<PriceRange>('1D');
  readonly periods: Readonly<Record<PriceRange, string>> = {
    '1D': 'Today',
    '1W': 'Past week',
    '1M': 'Past month',
    '3M': 'Past 3 months',
    '1Y': 'Past year',
    All: 'All time',
  };

  readonly scrubbed = signal<PricePoint | null>(null);
  readonly tradeFilter = signal<TradeFilter>('ALL');
  readonly showAllTrades = signal(false);

  readonly view = computed(() => {
    const t = this.trader.data();
    if (!t) return null;
    return {
      t,
      initials: initials(t.name),
      riskLabel: riskLabel(t),
      riskTone: riskTone(t),
      since: since(t),
      metrics: traderMetrics(t),
      started: formatUsd(t.startingCapital),
    };
  });

  readonly subscription = computed(() =>
    (this.subscriptions.data() ?? []).find((s) => s.copyTraderId === this.traderId()),
  );

  /** Cash left after valuing current holdings at last price. */
  private readonly cashAmount = computed(() => this.cash()?.amount ?? null);

  /** What today's live line is built from; a new key means the line must be rebuilt. */
  private readonly todayKey = computed(() => {
    const t = this.trader.data();
    const cash = this.cashAmount();
    const held = this.holdings.data();
    if (this.range() !== '1D' || !t || cash == null || !held) return null;
    return `${t.accountId}|${cash}|${held.map((h) => `${h.symbol}:${h.quantity}`).join(',')}`;
  });
  private readonly today = signal<{ key: string; series: IntradaySeries | null } | null>(null);
  private readonly todaySeries = computed(() => {
    const key = this.todayKey();
    const today = this.today();
    return key && today?.key === key ? today.series : undefined;
  });
  readonly todayLoading = computed(() => this.range() === '1D' && this.todaySeries() === undefined);
  readonly todayWindow = computed(() => {
    const s = this.todaySeries();
    return s ? { start: s.start, end: s.end } : null;
  });
  readonly todayReference = computed(() => this.todaySeries()?.previousClose ?? null);
  readonly live = computed(() => {
    const s = this.todaySeries();
    const now = this.market.now();
    if (!s || now < s.start || now > s.end) return false;
    return (this.holdings.data() ?? []).some((h) => marketFor(h.exchange)?.isOpen(now) ?? false);
  });

  readonly series = computed<readonly PricePoint[]>(() => {
    const today = this.todaySeries();
    if (today) return today.points;
    if (today === undefined && this.range() === '1D') return [];

    if (this.range() === 'All') {
      const t = this.trader.data();
      return t ? equitySeries(t) : [];
    }

    const raw = (this.history.data() ?? []).map((p) => ({ at: new Date(p.at), price: p.totalValue }));
    const points: PricePoint[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (i === 0 || raw[i].price !== raw[i - 1].price) points.push(raw[i]);
    }
    const t = this.trader.data();
    if (t && points.length && points[points.length - 1].price !== t.equity) {
      points.push({ at: new Date(), price: t.equity });
    }
    return points;
  });

  /** Equity at the scrubbed point (or now), and the change over the selected range. */
  readonly headline = computed(() => {
    const series = this.series();
    const t = this.trader.data();
    if (!t) return null;
    const point = this.scrubbed() ?? series[series.length - 1] ?? { at: new Date(), price: t.equity };
    const base = this.todayReference() ?? (this.range() === 'All' ? t.startingCapital : series[0]?.price ?? t.startingCapital);
    const delta = point.price - base;
    return {
      equity: formatUsd(point.price),
      delta: formatSignedUsd(delta),
      pct: formatSignedPct(base > 0 ? (delta / base) * 100 : null),
      tone: signTone(delta),
      period: this.scrubbed() ? formatStamp(point.at) : this.periods[this.range()],
    };
  });

  readonly positions = computed(() => {
    const t = this.trader.data();
    if (!t) return [];
    const basis = costBasis(this.trades.data() ?? []);
    const instruments = this.market.byId();
    const rows = (this.holdings.data() ?? []).map((h) => {
      const last = instruments.get(h.instrumentId)?.lastPrice ?? null;
      const b = basis.get(h.instrumentId);
      const avg = b && b.quantity > 0 ? b.cost / b.quantity : null;
      const value = last != null ? h.quantity * last : null;
      const pnl = value != null && avg != null ? value - h.quantity * avg : null;
      const pnlPct = pnl != null && avg ? (pnl / (h.quantity * avg)) * 100 : null;
      const weight = value != null && t.equity > 0 ? (value / t.equity) * 100 : 0;
      return {
        instrumentId: h.instrumentId,
        symbol: h.symbol,
        name: h.instrumentName,
        exchange: h.exchange,
        quantity: formatQty(h.quantity),
        avgCost: formatPrice(avg),
        last: formatPrice(last),
        value: formatUsd(value),
        pnl: formatSignedUsd(pnl),
        pnlValue: pnl,
        pnlPct: formatSignedPct(pnlPct),
        tone: signTone(pnl),
        weight,
        weightLabel: `${weight.toFixed(1)}%`,
        sortValue: value ?? 0,
      };
    });
    return rows.sort((a, b) => b.sortValue - a.sortValue);
  });

  readonly cash = computed(() => {
    const t = this.trader.data();
    if (!t) return null;
    const invested = this.positions().reduce((sum, p) => sum + p.sortValue, 0);
    const cash = Math.max(0, t.equity - invested);
    return { amount: cash, value: formatUsd(cash), weight: t.equity > 0 ? (cash / t.equity) * 100 : 0 };
  });

  /** Holdings by market value, largest first, then cash. */
  readonly allocation = computed(() => {
    const positions = this.positions().filter((p) => p.sortValue > 0);
    const shown = positions.length <= SLICE_COLORS.length ? positions : positions.slice(0, SLICE_COLORS.length - 1);
    const rest = positions.slice(shown.length);
    const segments: DonutSegment[] = shown.map((p, i) => ({
      key: p.symbol,
      label: p.symbol,
      sub: p.name,
      value: p.sortValue,
      valueLabel: p.value,
      color: SLICE_COLORS[i],
    }));
    if (rest.length) {
      const other = rest.reduce((sum, p) => sum + p.sortValue, 0);
      segments.push({
        key: 'other',
        label: `Other (${rest.length})`,
        sub: rest.map((p) => p.symbol).join(', '),
        value: other,
        valueLabel: formatUsd(other),
        color: SLICE_COLORS[SLICE_COLORS.length - 1],
      });
    }
    const cash = this.cash();
    if (cash && cash.amount > 0) {
      segments.push({ key: 'cash', label: 'Cash', sub: 'Not invested', value: cash.amount, valueLabel: cash.value, color: 'var(--series-neutral)' });
    }
    const invested = 100 - (cash?.weight ?? 0);
    return { segments, invested: `${invested.toFixed(0)}%`, holdings: positions.length };
  });

  readonly unrealised = computed(() => {
    const total = this.positions().reduce((sum, p) => sum + (p.pnlValue ?? 0), 0);
    return { value: formatSignedUsd(total), tone: signTone(total) };
  });

  readonly tradeCounts = computed(() => {
    const all = this.trades.data() ?? [];
    return { ALL: all.length, BUY: all.filter((o) => o.side === 'BUY').length, SELL: all.filter((o) => o.side === 'SELL').length };
  });

  readonly tradeRows = computed(() => {
    const filter = this.tradeFilter();
    const all = (this.trades.data() ?? []).filter((o) => filter === 'ALL' || o.side === filter);
    const shown = this.showAllTrades() ? all : all.slice(0, TRADES_SHOWN);
    return {
      total: all.length,
      hidden: all.length - shown.length,
      rows: shown.map((o) => ({
        id: o.orderId,
        instrumentId: o.instrumentId,
        symbol: o.symbol,
        name: this.market.instrument(o.instrumentId)?.name ?? o.symbol,
        side: o.side,
        when: formatStamp(o.fulfilledTime ?? o.placedTime),
        quantity: formatQty(o.quantity),
        price: formatPrice(o.price),
        value: formatUsd(o.value),
      })),
    };
  });

  readonly tradeFilters: readonly { key: TradeFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'BUY', label: 'Buys' },
    { key: 'SELL', label: 'Sells' },
  ];

  constructor() {
    // Reload when the trader changes, or after any order (a copy may have just been placed).
    effect(() => {
      this.traderId();
      this.ordersApi.changes();
      untracked(() => {
        this.trader.reload();
        this.trades.reload();
      });
    });
    effect(() => {
      if (this.trader.data()?.accountId != null) untracked(() => this.holdings.reload());
    });
    effect(() => {
      if (this.account.activeId() != null) untracked(() => this.subscriptions.reload());
    });
    effect(() => {
      this.trader.data()?.accountId;
      this.range();
      this.ordersApi.changes();
      untracked(() => {
        this.scrubbed.set(null);
        if (this.trader.data()?.accountId != null && this.range() !== '1D' && this.range() !== 'All') {
          this.history.reload();
        }
      });
    });

    effect(() => {
      const key = this.todayKey();
      if (key) untracked(() => void this.loadToday(key));
    });
    const tick = setInterval(() => {
      const key = this.todayKey();
      if (key && document.visibilityState === 'visible') void this.loadToday(key);
    }, LIVE_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  private async loadToday(key: string): Promise<void> {
    const held = this.holdings.data() ?? [];
    const cash = this.cashAmount() ?? 0;
    const loaded = await Promise.all(held.map((h) => this.intraday.series(h.symbol)));
    const series =
      held.length === 0
        ? null
        : loaded.every((s) => s != null)
          ? portfolioIntraday(
              held.map((h, i) => ({ quantity: h.quantity, series: loaded[i]! })),
              cash,
            )
          : null;
    if (this.todayKey() !== key) return;
    if (!series && this.today()?.key === key && this.today()?.series) return;
    this.today.set({ key, series });
  }

  setRange(range: PriceRange): void {
    this.range.set(range);
  }

  setTradeFilter(filter: TradeFilter): void {
    this.tradeFilter.set(filter);
    this.showAllTrades.set(false);
  }

  /** After following or stopping: copiers and AUM change too. */
  refresh(): void {
    this.subscriptions.reload();
    this.trader.reload();
  }
}
