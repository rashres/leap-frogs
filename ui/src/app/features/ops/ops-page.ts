import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

/** Operations home for David / Super Admin. */
@Component({
  selector: 'leap-ops-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader],
  template: `
    <leap-page-header heading="Operations">
      <span description>Monitor trading accounts, status, and audit activity.</span>
    </leap-page-header>
    <div class="grid">
      <a class="card" routerLink="/ops/accounts">
        <leap-icon name="users" [size]="22" />
        <div>
          <strong>Trading accounts</strong>
          <span>{{ accountCount() }} accounts — search, inspect, freeze</span>
        </div>
      </a>
      <a class="card" routerLink="/audit">
        <leap-icon name="activity" [size]="22" />
        <div>
          <strong>Audit logs</strong>
          <span>Order history across the platform</span>
        </div>
      </a>
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-top: 8px;
    }
    .card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 20px;
      border-radius: var(--radius-xl);
      border: 1px solid var(--border);
      background: var(--panel);
      box-shadow: var(--shadow-1);
      color: inherit;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .card:hover {
      border-color: var(--accent-line);
      background: var(--panel-hover);
    }
    .card strong {
      display: block;
      font-size: 15px;
    }
    .card span {
      display: block;
      margin-top: 4px;
      font-size: 13px;
      color: var(--text-3);
    }
  `,
})
export class OpsPage {
  private readonly accounts = inject(ActiveAccountService);
  readonly accountCount = computed(() => this.accounts.accounts().length);
}
