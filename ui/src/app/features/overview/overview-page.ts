import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstrumentsService } from '../../core/api/instruments.service';
import { createLoader } from '../../core/api/loader';
import { SystemService } from '../../core/api/system.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { ApiStatusService } from '../../core/state/api-status.service';
import { AsyncState } from '../../shared/async-state';
import { formatDateTime, formatUsd } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import { StatCard } from '../../shared/stat-card';

interface EndpointRow {
  method: 'GET' | 'POST';
  path: string;
  what: string;
  page: string;
  link: string;
}

@Component({
  selector: 'leap-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, StatCard, AsyncState],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
})
export class OverviewPage {
  private readonly system = inject(SystemService);
  private readonly instrumentsApi = inject(InstrumentsService);
  protected readonly account = inject(ActiveAccountService);
  protected readonly apiStatus = inject(ApiStatusService);

  readonly info = createLoader(() => this.system.info());
  readonly instruments = createLoader(() => this.instrumentsApi.list());

  readonly marketCount = computed(() => new Set((this.instruments.data() ?? []).map((i) => i.exchange)).size);
  readonly totalCash = computed(() => formatUsd(this.account.accounts().reduce((sum, a) => sum + a.cashBalance, 0)));

  readonly apiCard = computed(() => {
    const checkedAt = this.apiStatus.checkedAt();
    const sub = checkedAt ? `Checked ${formatDateTime(checkedAt.getTime())}` : 'Checking…';
    switch (this.apiStatus.status()) {
      case 'up':
        return { value: 'Online', tone: 'up', sub };
      case 'db-down':
        return { value: 'DB down', tone: 'down', sub };
      case 'unreachable':
        return { value: 'Offline', tone: 'down', sub };
      default:
        return { value: '…', tone: 'dim', sub };
    }
  });

  readonly endpoints: EndpointRow[] = [
    { method: 'GET', path: '/api', what: 'Service info and version', page: 'Overview', link: '/' },
    { method: 'GET', path: '/api/health', what: 'API + database health', page: 'Header badge', link: '/' },
    { method: 'GET', path: '/api/accounts', what: 'All accounts', page: 'Accounts', link: '/accounts' },
    { method: 'GET', path: '/api/accounts/{id}', what: 'One account with cash', page: 'Portfolio', link: '/portfolio' },
    { method: 'GET', path: '/api/accounts/{id}/holdings', what: 'Holdings across exchanges', page: 'Portfolio', link: '/portfolio' },
    { method: 'GET', path: '/api/accounts/{id}/orders', what: 'Order history', page: 'Orders', link: '/orders' },
    { method: 'POST', path: '/api/accounts/{id}/orders', what: 'Place a buy or sell order', page: 'Portfolio, Instruments', link: '/instruments' },
    { method: 'GET', path: '/api/instruments', what: 'All instruments', page: 'Instruments', link: '/instruments' },
    { method: 'GET', path: '/api/instruments/{id}', what: 'One instrument', page: 'Instruments (row detail)', link: '/instruments' },
  ];

  constructor() {
    this.info.reload();
    this.instruments.reload();
  }

  refresh(): void {
    this.info.reload();
    this.instruments.reload();
    this.account.refresh();
    this.apiStatus.check();
  }
}
