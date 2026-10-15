import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsService } from '../../core/api/accounts.service';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import { createLoader } from '../../core/api/loader';
import { OrdersService } from '../../core/api/orders.service';
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

/** Donut slice colours, in fixed order. Past four holdings the rest fold into "Other". */
const SLICE_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

/**
 * One lead trader: performance (equity curve and every headline metric),
 * their current portfolio, and their full trade history. Route /copy-trading/:id.
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
  protected readonly account = inject(ActiveAccountService);

  /** From the route, via withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly traderId = computed(() => Number(this.id()));

  readonly trader = createLoader(() => this.api.trader(this.traderId()));
  readonly trades = createLoader(() => this.api.traderOrders(this.traderId()));
  readonly holdings = createLoader(() => this.accountsApi.holdings(this.trader.data()!.accountId));
  readonly subscriptions = createLoader(() => this.api.subscriptions(this.account.activeId()!));

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

  readonly series = computed(() => {
    const t = this.trader.data();
    return t ? equitySeries(t) : [];
  });

  /** Equity at the scrubbed point (or now), and the change from the start of the curve. */
  readonly headline = computed(() => {
    const series = this.series();
    const t = this.trader.data();
    if (!t) return null;
    const point = this.scrubbed() ?? series[series.length - 1] ?? { at: new Date(), price: t.equity };
    const base = t.startingCapital;
    const delta = point.price - base;
    return {
      equity: formatUsd(point.price),
      delta: formatSignedUsd(delta),
      pct: formatSignedPct(base > 0 ? (delta / base) * 100 : null),
      tone: signTone(delta),
      at: this.scrubbed() ? formatStamp(point.at) : 'Now',
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
