import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountsService } from '../../core/api/accounts.service';
import { InstrumentsService } from '../../core/api/instruments.service';
import { createLoader } from '../../core/api/loader';
import type { OrderSide } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { AsyncState } from '../../shared/async-state';
import { DateTimePipe, UsdPipe } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { PageHeader } from '../../shared/page-header';
import { SideSheet } from '../../shared/side-sheet';
import { OrderTicket } from '../trading/order-ticket';

const ALL = 'All markets';

@Component({
  selector: 'leap-instruments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, AsyncState, InstrumentLogo, SideSheet, OrderTicket, UsdPipe, DateTimePipe],
  templateUrl: './instruments-page.html',
  styleUrl: './instruments-page.scss',
})
export class InstrumentsPage {
  private readonly instrumentsApi = inject(InstrumentsService);
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  protected readonly active = inject(ActiveAccountService);

  readonly list = createLoader(() => this.instrumentsApi.list());
  /** GET /api/instruments/{id}, loaded when a row is opened. */
  readonly detail = createLoader(() => this.instrumentsApi.get(this.selectedId()!));
  /** Active account's holdings, so the ticket can show what is held and offer "Max" on sells. */
  readonly holdings = createLoader(() => this.accountsApi.holdings(this.active.activeId()!));

  readonly market = signal(ALL);
  readonly query = signal('');
  readonly selectedId = signal<number | null>(null);
  readonly ticketSide = signal<OrderSide>('BUY');

  readonly markets = computed(() => [ALL, ...new Set((this.list.data() ?? []).map((i) => i.exchange))]);

  readonly counts = computed(() => {
    const counts: Record<string, number> = { [ALL]: this.list.data()?.length ?? 0 };
    for (const i of this.list.data() ?? []) {
      counts[i.exchange] = (counts[i.exchange] ?? 0) + 1;
    }
    return counts;
  });

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.list.data() ?? []).filter(
      (i) =>
        (this.market() === ALL || i.exchange === this.market()) &&
        (!q || i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)),
    );
  });

  readonly hasPrices = computed(() => (this.list.data() ?? []).some((i) => i.lastPrice != null));

  readonly selected = computed(() => {
    const fromDetail = this.detail.data();
    return fromDetail && fromDetail.instrumentId === this.selectedId()
      ? fromDetail
      : (this.list.data() ?? []).find((i) => i.instrumentId === this.selectedId());
  });

  constructor() {
    this.list.reload();

    effect(() => {
      const id = this.active.activeId();
      this.ordersApi.changes();
      if (id != null) {
        untracked(() => this.holdings.reload());
      }
    });

    effect(() => {
      if (this.selectedId() != null) {
        untracked(() => this.detail.reload());
      }
    });
  }

  open(instrumentId: number, side: OrderSide = 'BUY'): void {
    this.ticketSide.set(side);
    this.selectedId.set(instrumentId);
  }

  close(): void {
    this.selectedId.set(null);
  }

  setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
