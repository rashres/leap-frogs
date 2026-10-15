import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import { createLoader } from '../../core/api/loader';
import type { CopyTrader } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatPrice, formatQty, formatSignedPct, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { PageHeader } from '../../shared/page-header';

const RISK_LABELS: Record<CopyTrader['riskLevel'], string> = { LOW: 'Low risk', MEDIUM: 'Medium risk', HIGH: 'High risk' };
const RISK_TONES: Record<CopyTrader['riskLevel'], string> = { LOW: 'up', MEDIUM: 'warn', HIGH: 'down' };

/**
 * Lead traders to copy, and the traders the active account is copying.
 * Copying starts from the next trade: GET/POST /api/accounts/{id}/copy-subscriptions.
 */
@Component({
  selector: 'leap-copy-trading-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, Icon, InstrumentLogo],
  templateUrl: './copy-trading-page.html',
  styleUrl: './copy-trading-page.scss',
})
export class CopyTradingPage {
  private readonly api = inject(CopyTradingService);
  private readonly ordersApi = inject(OrdersService);
  protected readonly account = inject(ActiveAccountService);

  readonly traders = createLoader(() => this.api.traders());
  readonly subscriptions = createLoader(() => this.api.subscriptions(this.account.activeId()!));
  readonly trades = createLoader(() => this.api.traderOrders(this.selectedId()!));

  /** The trader whose recent trades are shown. */
  readonly selectedId = signal<number | null>(null);
  /** The trader whose copy form is open, and what is typed in it. */
  readonly copyingId = signal<number | null>(null);
  readonly allocation = signal('');
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);
  readonly stopError = signal<string | null>(null);

  readonly cash = computed(() => this.account.active()?.cashBalance ?? 0);

  /** The active account's own trader profile, when it is a lead trader. */
  readonly self = computed(() => (this.traders.data() ?? []).find((t) => t.accountId === this.account.activeId()));

  readonly cards = computed(() => {
    const following = new Map((this.subscriptions.data() ?? []).map((s) => [s.copyTraderId, s]));
    const own = this.account.activeId();
    return [...(this.traders.data() ?? [])]
      .sort((a, b) => (b.returnPercent ?? -Infinity) - (a.returnPercent ?? -Infinity))
      .map((t, i) => ({
        ...t,
        rank: i + 1,
        initials: initials(t.name),
        returnLabel: formatSignedPct(t.returnPercent),
        returnTone: (t.returnPercent ?? 0) >= 0 ? 'up' : 'down',
        winRateLabel: t.winRate == null ? '—' : `${t.winRate.toFixed(0)}%`,
        equityLabel: formatUsd(t.equity),
        riskLabel: RISK_LABELS[t.riskLevel] ?? t.riskLevel,
        riskTone: RISK_TONES[t.riskLevel] ?? 'muted',
        since: new Date(t.tradingSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        following: following.get(t.copyTraderId),
        isSelf: t.accountId === own,
      }));
  });

  readonly selected = computed(() => this.cards().find((c) => c.copyTraderId === this.selectedId()));

  readonly subscriptionRows = computed(() =>
    (this.subscriptions.data() ?? []).map((s) => ({
      ...s,
      initials: initials(s.traderName),
      allocationLabel: formatUsd(s.allocation),
      since: formatStamp(s.startedAt),
    })),
  );

  readonly totalAllocated = computed(() => (this.subscriptions.data() ?? []).reduce((sum, s) => sum + s.allocation, 0));

  readonly tradeRows = computed(() =>
    (this.trades.data() ?? []).map((o) => ({
      id: o.orderId,
      instrumentId: o.instrumentId,
      symbol: o.symbol,
      side: o.side,
      when: formatStamp(o.fulfilledTime ?? o.placedTime),
      quantity: formatQty(o.quantity),
      price: formatPrice(o.price),
      value: formatUsd(o.value),
    })),
  );

  constructor() {
    this.traders.reload();
    effect(() => {
      const id = this.account.activeId();
      this.ordersApi.changes();
      if (id != null) {
        untracked(() => {
          this.subscriptions.reload();
          this.traders.reload();
        });
      }
    });
    effect(() => {
      if (this.selectedId() != null) untracked(() => this.trades.reload());
    });
  }

  view(copyTraderId: number): void {
    this.selectedId.update((current) => (current === copyTraderId ? null : copyTraderId));
  }

  openCopy(trader: CopyTrader): void {
    this.copyingId.set(trader.copyTraderId);
    this.formError.set(null);
    // Suggest a quarter of the cash, rounded down to the nearest $500.
    const suggested = Math.floor((this.cash() * 0.25) / 500) * 500;
    this.allocation.set(suggested > 0 ? String(suggested) : '');
  }

  closeCopy(): void {
    this.copyingId.set(null);
    this.formError.set(null);
  }

  onAllocationInput(event: Event): void {
    this.allocation.set((event.target as HTMLInputElement).value);
  }

  confirmCopy(event: Event, copyTraderId: number): void {
    event.preventDefault();
    const accountId = this.account.activeId();
    const amount = Number(this.allocation());
    if (accountId == null || this.busy()) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      this.formError.set('Enter an amount greater than $0.');
      return;
    }
    if (amount > this.cash()) {
      this.formError.set(`That is more than your cash balance of ${formatUsd(this.cash())}.`);
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    this.api.follow(accountId, copyTraderId, amount).subscribe({
      next: () => {
        this.busy.set(false);
        this.copyingId.set(null);
        this.subscriptions.reload();
        this.traders.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.formError.set(toApiError(error).message);
      },
    });
  }

  stop(subscriptionId: number): void {
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    this.busy.set(true);
    this.stopError.set(null);
    this.api.unfollow(accountId, subscriptionId).subscribe({
      next: () => {
        this.busy.set(false);
        this.subscriptions.reload();
        this.traders.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.stopError.set(toApiError(error).message);
      },
    });
  }

  protected readonly formatUsd = formatUsd;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
