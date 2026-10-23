import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OpsService } from '../../core/api/ops.service';
import type { Account } from '../../core/api/models';
import { toApiError } from '../../core/api/api-error';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { TPipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'leap-ops-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, RouterLink, Icon, PageHeader],
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
