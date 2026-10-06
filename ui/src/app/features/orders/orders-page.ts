import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { createLoader } from '../../core/api/loader';
import type { OrderSide } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { AsyncState } from '../../shared/async-state';
import { formatUsd } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { StatCard } from '../../shared/stat-card';
import { OrdersTable } from '../trading/orders-table';

type StatusFilter = 'All' | 'Completed' | 'Rejected';
type SideFilter = 'All' | OrderSide;

@Component({
  selector: 'leap-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, StatCard, AsyncState, OrdersTable],
  template: `
    <leap-page-header
      title="Orders"
      [subtitle]="
        'Order history for ' + (active.active()?.name ?? '…') + ', newest first. Completed and rejected orders are both kept.'
      "
      mascot="orders"
    >
      <input
        class="input search"
        type="search"
        placeholder="Filter by symbol"
        aria-label="Filter orders by symbol"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      <button type="button" class="btn" (click)="orders.reload()" [disabled]="active.activeId() == null">Refresh</button>
    </leap-page-header>

    @if (active.activeId() == null) {
      <section class="panel">
        <leap-async-state
          [loading]="!active.loaded()"
          [error]="active.error()"
          [empty]="true"
          emptyText="No account selected."
          (retry)="active.refresh()"
        />
      </section>
    } @else {
      <div class="stats">
        <leap-stat-card label="Orders" [value]="all().length" [sub]="completedCount() + ' completed · ' + rejectedCount() + ' rejected'" />
        <leap-stat-card label="Bought" [value]="boughtText()" sub="Completed BUY value" />
        <leap-stat-card label="Sold" [value]="soldText()" sub="Completed SELL value" />
      </div>

      <div class="toolbar filters">
        <div class="segmented" role="group" aria-label="Filter by status">
          @for (f of statusFilters; track f) {
            <button type="button" [class.on]="status() === f" (click)="status.set(f)">
              {{ f }}<span class="count num">{{ statusCounts()[f] }}</span>
            </button>
          }
        </div>
        <div class="segmented" role="group" aria-label="Filter by side">
          @for (f of sideFilters; track f) {
            <button type="button" [class.on]="side() === f" (click)="side.set(f)">{{ f === 'All' ? 'Both sides' : f }}</button>
          }
        </div>
      </div>

      <section class="panel">
        <leap-async-state
          [loading]="orders.initialLoading()"
          [error]="orders.error()"
          [empty]="rows().length === 0"
          [emptyText]="all().length === 0 ? 'No orders yet for this account.' : 'No orders match these filters.'"
          (retry)="orders.reload()"
        >
          <a empty class="btn btn-sm" routerLink="/instruments">Browse instruments</a>
          <leap-orders-table [orders]="rows()" />
        </leap-async-state>
      </section>
    }
  `,
  styles: [
    `
      .search {
        width: 200px;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }
      .filters {
        margin-bottom: 14px;
      }
      @media (max-width: 760px) {
        .stats {
          grid-template-columns: minmax(0, 1fr);
        }
        .search {
          width: 100%;
        }
      }
    `,
  ],
})
export class OrdersPage {
  private readonly ordersApi = inject(OrdersService);
  protected readonly active = inject(ActiveAccountService);

  readonly orders = createLoader(() => this.ordersApi.list(this.active.activeId()!));

  readonly statusFilters: StatusFilter[] = ['All', 'Completed', 'Rejected'];
  readonly sideFilters: SideFilter[] = ['All', 'BUY', 'SELL'];

  readonly status = signal<StatusFilter>('All');
  readonly side = signal<SideFilter>('All');
  readonly query = signal('');

  readonly all = computed(() => this.orders.data() ?? []);
  readonly completedCount = computed(() => this.all().filter((o) => o.status === 'COMPLETE').length);
  readonly rejectedCount = computed(() => this.all().filter((o) => o.status === 'FAILED').length);

  readonly statusCounts = computed<Record<StatusFilter, number>>(() => ({
    All: this.all().length,
    Completed: this.completedCount(),
    Rejected: this.rejectedCount(),
  }));

  readonly boughtText = computed(() => formatUsd(this.sumValue('BUY')));
  readonly soldText = computed(() => formatUsd(this.sumValue('SELL')));

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.all().filter(
      (o) =>
        (this.status() === 'All' ||
          (this.status() === 'Completed' && o.status === 'COMPLETE') ||
          (this.status() === 'Rejected' && o.status === 'FAILED')) &&
        (this.side() === 'All' || o.side === this.side()) &&
        (!q || o.symbol.toLowerCase().includes(q)),
    );
  });

  constructor() {
    effect(() => {
      const id = this.active.activeId();
      this.ordersApi.changes();
      if (id != null) {
        untracked(() => this.orders.reload());
      }
    });
  }

  private sumValue(side: OrderSide): number {
    return this.all()
      .filter((o) => o.side === side && o.status === 'COMPLETE')
      .reduce((sum, o) => sum + o.value, 0);
  }
}
