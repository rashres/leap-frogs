import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import { createLoader } from '../../core/api/loader';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatSignedPct, formatSignedUsd, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { Sparkline } from '../../shared/sparkline';
import { CopyControl } from './copy-control';
import { equitySeries, initials, riskLabel, riskTone, signTone, since, traderMetrics } from './trader-view';

type SortKey = 'roi' | 'pnl' | 'sharpeRatio' | 'aum' | 'copiers';

/** Metrics shown in each card's grid; ROI and PnL lead the card on their own. */
const GRID_METRICS = new Set(['mdd', 'sharpe', 'aum', 'copiers', 'success', 'equity']);

/**
 * Lead traders to copy, and the traders the active account is copying.
 * Each trader has a profile at /copy-trading/:id.
 */
@Component({
  selector: 'leap-copy-trading-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, Icon, Sparkline, CopyControl],
  templateUrl: './copy-trading-page.html',
  styleUrl: './copy-trading-page.scss',
})
export class CopyTradingPage {
  private readonly api = inject(CopyTradingService);
  private readonly ordersApi = inject(OrdersService);
  protected readonly account = inject(ActiveAccountService);

  readonly traders = createLoader(() => this.api.traders());
  readonly subscriptions = createLoader(() => this.api.subscriptions(this.account.activeId()!));

  readonly sorts: readonly { key: SortKey; label: string }[] = [
    { key: 'roi', label: 'ROI' },
    { key: 'pnl', label: 'PnL' },
    { key: 'sharpeRatio', label: 'Sharpe' },
    { key: 'aum', label: 'AUM' },
    { key: 'copiers', label: 'Copiers' },
  ];
  readonly sort = signal<SortKey>('roi');

  /** The active account's own trader profile, when it is a lead trader. */
  readonly self = computed(() => (this.traders.data() ?? []).find((t) => t.accountId === this.account.activeId()));

  readonly cards = computed(() => {
    const following = new Map((this.subscriptions.data() ?? []).map((s) => [s.copyTraderId, s]));
    const key = this.sort();
    return [...(this.traders.data() ?? [])]
      .sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity))
      .map((t, i) => ({
        trader: t,
        id: t.copyTraderId,
        rank: i + 1,
        initials: initials(t.name),
        roi: formatSignedPct(t.roi),
        pnl: formatSignedUsd(t.pnl),
        tone: signTone(t.roi),
        riskLabel: riskLabel(t),
        riskTone: riskTone(t),
        since: since(t),
        series: equitySeries(t),
        grid: traderMetrics(t).filter((m) => GRID_METRICS.has(m.key)),
        subscription: following.get(t.copyTraderId),
      }));
  });

  readonly subscriptionRows = computed(() => {
    const traders = new Map((this.traders.data() ?? []).map((t) => [t.copyTraderId, t]));
    return (this.subscriptions.data() ?? []).map((s) => ({
      sub: s,
      trader: traders.get(s.copyTraderId),
      roi: formatSignedPct(traders.get(s.copyTraderId)?.roi),
      roiTone: signTone(traders.get(s.copyTraderId)?.roi),
      initials: initials(s.traderName),
      allocation: formatUsd(s.allocation),
      since: formatStamp(s.startedAt),
    }));
  });

  readonly copySummary = computed(() => {
    const subs = this.subscriptions.data() ?? [];
    return {
      allocated: formatUsd(subs.reduce((sum, s) => sum + s.allocation, 0)),
      traders: subs.length,
      copied: subs.reduce((sum, s) => sum + s.copiedOrders, 0),
    };
  });

  constructor() {
    effect(() => {
      const id = this.account.activeId();
      this.ordersApi.changes();
      untracked(() => {
        this.traders.reload();
        if (id != null) this.subscriptions.reload();
      });
    });
  }

  /** After following or stopping: copier counts and AUM change too. */
  refresh(): void {
    this.subscriptions.reload();
    this.traders.reload();
  }
}
