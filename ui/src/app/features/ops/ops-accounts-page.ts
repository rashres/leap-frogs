import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OpsService } from '../../core/api/ops.service';
import type { Account } from '../../core/api/models';
import { toApiError } from '../../core/api/api-error';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { Pager, pageOf } from '../../shared/pager';
import { TPipe } from '../../core/i18n/t.pipe';

/** Accounts shown per page. */
const PAGE_SIZE = 20;

@Component({
  selector: 'leap-ops-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, RouterLink, Icon, PageHeader, Pager],
  templateUrl: './ops-accounts-page.html',
  styleUrl: './ops-accounts-page.scss',
})
export class OpsAccountsPage {
  private readonly ops = inject(OpsService);

  readonly q = signal('');
  readonly status = signal('');
  readonly rows = signal<Account[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly pageSize = PAGE_SIZE;
  /** Zero-based; back to the first page whenever a search returns new rows. */
  readonly page = linkedSignal({ source: this.rows, computation: () => 0 });
  readonly pageRows = computed(() => pageOf(this.rows(), this.page(), PAGE_SIZE));

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.ops.search(this.q(), this.status()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  cash(a: Account): string {
    return formatUsd(a.cashBalance);
  }
}
