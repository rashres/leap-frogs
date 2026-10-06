import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsService } from '../../core/api/accounts.service';
import { InstrumentsService } from '../../core/api/instruments.service';
import { createLoader } from '../../core/api/loader';
import type { OrderSide } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { AsyncState } from '../../shared/async-state';
import { formatUsd } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { StatCard } from '../../shared/stat-card';
import { HoldingsTable, type TradeIntent } from '../trading/holdings-table';
import { OrderTicket } from '../trading/order-ticket';
import { OrdersTable } from '../trading/orders-table';

/**
 * One account: cash, holdings across every exchange, order ticket and recent
 * orders. Serves both /accounts/:id and /portfolio (the active account).
 */
@Component({
  selector: 'leap-account-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, StatCard, AsyncState, HoldingsTable, OrdersTable, OrderTicket],
  templateUrl: './account-detail-page.html',
  styleUrl: './account-detail-page.scss',
})
export class AccountDetailPage {
  private readonly accountsApi = inject(AccountsService);
  private readonly instrumentsApi = inject(InstrumentsService);
  private readonly ordersApi = inject(OrdersService);
  protected readonly active = inject(ActiveAccountService);

  /** Route param; absent on /portfolio, which shows the active account. */
  readonly id = input<string>();

  readonly accountId = computed<number | null>(() => {
    const raw = this.id();
    return raw != null ? Number(raw) : this.active.activeId();
  });

  readonly isPortfolio = computed(() => this.id() == null);

  readonly account = createLoader(() => this.accountsApi.get(this.accountId()!));
  readonly holdings = createLoader(() => this.accountsApi.holdings(this.accountId()!));
  readonly orders = createLoader(() => this.ordersApi.list(this.accountId()!));
  readonly instruments = createLoader(() => this.instrumentsApi.list());

  readonly ticketInstrumentId = signal<number | null>(null);
  readonly ticketSide = signal<OrderSide>('BUY');

  readonly recentOrders = computed(() => (this.orders.data() ?? []).slice(0, 8));
  readonly rejectedCount = computed(() => (this.orders.data() ?? []).filter((o) => o.status === 'FAILED').length);
  readonly cashText = computed(() => formatUsd(this.account.data()?.cashBalance));

  constructor() {
    this.instruments.reload();

    // Reload when the account changes or after any order is placed.
    effect(() => {
      const id = this.accountId();
      this.ordersApi.changes();
      if (id == null || Number.isNaN(id)) {
        return;
      }
      untracked(() => {
        this.account.reload();
        this.holdings.reload();
        this.orders.reload();
      });
    });
  }

  prefill(intent: TradeIntent): void {
    this.ticketInstrumentId.set(intent.instrumentId);
    this.ticketSide.set(intent.side);
    document.getElementById('order-ticket')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  reloadAll(): void {
    this.account.reload();
    this.holdings.reload();
    this.orders.reload();
  }
}
