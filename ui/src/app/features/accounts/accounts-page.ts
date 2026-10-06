import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { AsyncState } from '../../shared/async-state';
import { UsdPipe } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'leap-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, AsyncState, UsdPipe],
  template: `
    <leap-page-header title="Accounts" subtitle="Every account from GET /api/accounts. Open one to see its holdings and orders, or act as it.">
      <input
        class="input search"
        type="search"
        placeholder="Search name or email"
        aria-label="Search accounts"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
      <button type="button" class="btn" (click)="account.refresh()">Refresh</button>
    </leap-page-header>

    <section class="panel">
      <leap-async-state
        [loading]="!account.loaded()"
        [error]="account.error()"
        [empty]="rows().length === 0"
        [emptyText]="query() ? 'No accounts match “' + query() + '”.' : 'No accounts in the database.'"
        (retry)="account.refresh()"
      >
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="r">#</th>
                <th>Name</th>
                <th>Email</th>
                <th class="r">Cash balance</th>
                <th class="r"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (a of rows(); track a.accountId) {
                <tr class="clickable" (click)="open(a.accountId)">
                  <td class="r num faint">{{ a.accountId }}</td>
                  <td>
                    <span class="strong">{{ a.name }}</span>
                    @if (a.accountId === account.activeId()) {
                      <span class="pill pill-accent acting">Acting as</span>
                    }
                  </td>
                  <td class="dim">{{ a.email }}</td>
                  <td class="r num strong">{{ a.cashBalance | usd }}</td>
                  <td class="r">
                    <div class="row-actions">
                      @if (a.accountId !== account.activeId()) {
                        <button type="button" class="btn btn-sm" (click)="$event.stopPropagation(); account.select(a.accountId)">
                          Act as
                        </button>
                      }
                      <button type="button" class="btn btn-sm" (click)="$event.stopPropagation(); open(a.accountId)">Open</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </leap-async-state>
    </section>
  `,
  styles: [
    `
      .search {
        width: 240px;
      }
      .acting {
        margin-left: 8px;
      }
      .row-actions {
        display: inline-flex;
        gap: 6px;
      }
      @media (max-width: 520px) {
        .search {
          width: 100%;
        }
      }
    `,
  ],
})
export class AccountsPage {
  protected readonly account = inject(ActiveAccountService);
  private readonly router = inject(Router);

  readonly query = signal('');

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.account.accounts();
    return q ? list.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : list;
  });

  constructor() {
    this.account.refresh();
  }

  open(accountId: number): void {
    this.router.navigate(['/accounts', accountId]);
  }
}
