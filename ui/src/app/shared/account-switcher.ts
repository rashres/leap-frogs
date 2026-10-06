import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActiveAccountService } from '../core/state/active-account.service';
import { UsdPipe } from './format';

/** Header control choosing which account the console acts as (stand-in for sign-in). */
@Component({
  selector: 'leap-account-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UsdPipe],
  template: `
    @let active = account.active();
    <label class="switcher" [class.disabled]="account.accounts().length === 0">
      <span class="avatar" aria-hidden="true">{{ initials(active?.name) }}</span>
      <span class="text">
        <span class="caption">Acting as</span>
        <span class="name">{{ active?.name ?? (account.loaded() ? 'No accounts' : 'Loading…') }}</span>
      </span>
      @if (active) {
        <span class="cash num">{{ active.cashBalance | usd }}</span>
      }
      <select
        class="native"
        aria-label="Choose the account to act as"
        [value]="active?.accountId ?? ''"
        [disabled]="account.accounts().length === 0"
        (change)="choose($event)"
      >
        @for (a of account.accounts(); track a.accountId) {
          <option [value]="a.accountId" [selected]="a.accountId === active?.accountId">
            #{{ a.accountId }} · {{ a.name }}
          </option>
        }
      </select>
    </label>
  `,
  styles: [
    `
      .switcher {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 4px 12px 4px 4px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--panel);
        cursor: pointer;
        max-width: 320px;
        transition: border-color 0.13s ease;
      }
      .switcher:hover:not(.disabled),
      .switcher:focus-within {
        border-color: var(--border-strong);
      }
      .switcher.disabled {
        cursor: default;
        opacity: 0.7;
      }
      .avatar {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--panel-3);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        color: var(--text-2);
      }
      .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.15;
      }
      .caption {
        font-size: 10px;
        font-weight: 650;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-3);
      }
      .name {
        font-size: 13px;
        font-weight: 650;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cash {
        font-size: 12px;
        color: var(--text-2);
        padding-left: 10px;
        border-left: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      /* The real select covers the pill so it stays keyboard and screen-reader native. */
      .native {
        position: absolute;
        inset: 0;
        width: 100%;
        opacity: 0;
        cursor: inherit;
      }
      @media (max-width: 520px) {
        .cash {
          display: none;
        }
      }
    `,
  ],
})
export class AccountSwitcher {
  protected readonly account = inject(ActiveAccountService);

  choose(event: Event): void {
    this.account.select(Number((event.target as HTMLSelectElement).value));
  }

  initials(name: string | undefined): string {
    if (!name) {
      return '?';
    }
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
}
