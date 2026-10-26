import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { AccountsService } from '../../core/api/accounts.service';
import { toApiError } from '../../core/api/api-error';
import type { Account } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { tk, translate } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';

/** The API takes up to this much in one deposit. */
const MAX_DEPOSIT = 1_000_000;
const QUICK_DEPOSITS = [100, 1_000, 10_000] as const;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

type Mode = 'deposit' | 'withdraw';

/**
 * "Add cash" and "Withdraw" next to the Available cash figure. Each opens a
 * small form that posts to /api/accounts/{id}/deposits or /withdrawals, then
 * refreshes everything that shows cash. Only available cash can be withdrawn
 * (cash held for pending buy orders stays put). A frozen account can do neither.
 *
 * The form opens from the left edge of the nearest positioned ancestor (the
 * Available cash card), never leftwards from the buttons: when the buttons wrap
 * to the card's left edge, a box opening leftwards slid under the fixed sidebar.
 */
@Component({
  selector: 'leap-cash-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, Icon],
  host: {
    '(document:keydown.escape)': 'close()',
    '(document:click)': 'closeOutside($event)',
  },
  template: `
    <div class="buttons">
      <button
        type="button"
        class="btn btn-secondary btn-sm act"
        [class.on]="mode() === 'deposit'"
        [disabled]="locked()"
        [attr.title]="frozen() ? ('This account is frozen, so cash cannot be added or withdrawn.' | t) : null"
        aria-controls="cash-panel"
        [attr.aria-expanded]="mode() === 'deposit'"
        (click)="toggle('deposit')"
      >
        <leap-icon name="plus" [size]="14" />{{ 'Add cash' | t }}
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-sm act"
        [class.on]="mode() === 'withdraw'"
        [disabled]="locked() || available() <= 0"
        [attr.title]="frozen() ? ('This account is frozen, so cash cannot be added or withdrawn.' | t) : available() <= 0 ? ('No cash available to withdraw.' | t) : null"
        aria-controls="cash-panel"
        [attr.aria-expanded]="mode() === 'withdraw'"
        (click)="toggle('withdraw')"
      >
        <leap-icon name="minus" [size]="14" />{{ 'Withdraw' | t }}
      </button>
    </div>

    @if (mode(); as m) {
      <form class="pop" id="cash-panel" [attr.aria-label]="(m === 'deposit' ? 'Add cash' : 'Withdraw cash') | t" (submit)="submit($event)" novalidate>
        <label class="field-label" for="cash-amount">{{ 'Amount (USD)' | t }}</label>
        <div class="amount" [class.bad]="error()">
          <span class="affix" aria-hidden="true">$</span>
          <input
            id="cash-amount"
            class="control num"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            [value]="amount()"
            (input)="setAmount($any($event.target).value)"
            [attr.aria-invalid]="!!error()"
          />
        </div>
        <div class="quick" role="group" [attr.aria-label]="'Quick amounts' | t">
          @if (m === 'deposit') {
            @for (q of quickDeposits; track q) {
              <button type="button" (click)="setAmount(q.toString())">+{{ usd(q) }}</button>
            }
          } @else {
            @for (q of quickWithdrawals(); track q.label) {
              <button type="button" (click)="setAmount(q.value)">{{ q.label | t }}</button>
            }
          }
        </div>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message | t }}</p>
        }
        <div class="actions">
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">{{ 'Cancel' | t }}</button>
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">
            @if (m === 'deposit') {
              {{ (busy() ? 'Adding…' : 'Add cash') | t }}
            } @else {
              {{ (busy() ? 'Withdrawing…' : 'Withdraw') | t }}
            }
          </button>
        </div>
        <p class="note">
          @if (m === 'deposit') {
            {{ 'Cash is added straight away. Up to {max} at a time.' | t: { max: usd(max) } }}
          } @else {
            {{ '{amount} available to withdraw. Cash held for pending orders stays in the account.' | t: { amount: usd(available()) } }}
          }
        </p>
      </form>
    }

    @if (done(); as text) {
      <p class="done" role="status">{{ text }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 8px;
      }
      .buttons {
        display: inline-flex;
        gap: 6px;
      }
      .act {
        gap: 4px;
        height: 26px;
        padding: 0 9px;
        font-size: 12px;
      }
      .act.on {
        border-color: var(--accent);
        color: var(--accent);
      }
      .pop {
        position: absolute;
        z-index: 30;
        top: calc(100% - 6px);
        left: 12px;
        width: 280px;
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--panel);
        box-shadow: var(--shadow-2);
        animation: leap-rise 0.16s var(--ease) both;
      }
      .amount {
        position: relative;
        margin-top: 6px;
      }
      .amount .control {
        width: 100%;
        padding-left: 24px;
      }
      .amount.bad .control {
        border-color: var(--down);
      }
      .affix {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-3);
        font-size: 13px;
      }
      .quick {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      .quick button {
        flex: 1;
        padding: 4px 0;
        border: 1px solid var(--border);
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-2);
      }
      .quick button:hover {
        border-color: var(--accent);
        color: var(--accent);
      }
      .error {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--down);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
      }
      .note {
        margin: 10px 0 0;
        font-size: 11.5px;
        line-height: 1.45;
        color: var(--text-3);
      }
      .done {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--up);
      }
      @media (max-width: 560px) {
        .pop {
          left: 0;
          width: min(280px, calc(100vw - 48px));
        }
      }
    `,
  ],
})
export class CashActions {
  protected readonly account = inject(ActiveAccountService);
  private readonly portfolio = inject(PortfolioStore);
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly quickDeposits = QUICK_DEPOSITS;
  protected readonly max = MAX_DEPOSIT;
  protected readonly usd = (value: number) => formatUsd(value);

  /** Which form is open, if any. */
  readonly mode = signal<Mode | null>(null);
  readonly amount = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  /** "Added $500.00" or "Withdrew $500.00" for a few seconds afterwards. */
  readonly done = signal<string | null>(null);

  readonly frozen = computed(() => this.account.active()?.status === 'FROZEN');
  readonly locked = computed(() => this.frozen() || this.account.activeId() == null);
  /** Cash not held back for pending buy orders, rounded down to the cent. */
  readonly available = computed(() => Math.max(0, Math.floor((this.portfolio.availableCash() ?? 0) * 100) / 100));
  readonly quickWithdrawals = computed(() => {
    const all = this.available();
    const half = Math.floor(all * 50) / 100;
    return [
      { label: tk('Half'), value: half.toFixed(2) },
      { label: tk('All available'), value: all.toFixed(2) },
    ];
  });

  private doneTimer: ReturnType<typeof setTimeout> | undefined;

  toggle(mode: Mode): void {
    if (this.mode() === mode) {
      this.close();
      return;
    }
    this.amount.set('');
    this.error.set(null);
    this.mode.set(mode);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>('#cash-amount')?.focus());
  }

  close(): void {
    this.mode.set(null);
  }

  closeOutside(event: MouseEvent): void {
    if (this.mode() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  setAmount(text: string): void {
    this.amount.set(text);
    this.error.set(null);
  }

  submit(event: Event): void {
    event.preventDefault();
    const mode = this.mode();
    const accountId = this.account.activeId();
    if (!mode || accountId == null || this.busy()) return;
    const text = this.amount().trim().replace(/,/g, '');
    const value = Number(text);
    if (!AMOUNT.test(text) || !(value > 0)) {
      this.error.set(tk('Enter an amount above $0 with at most 2 decimal places.'));
      return;
    }
    if (mode === 'deposit' && value > MAX_DEPOSIT) {
      this.error.set(translate('You can add up to {max} at a time.', { max: formatUsd(MAX_DEPOSIT) }));
      return;
    }
    if (mode === 'withdraw' && value > this.available()) {
      this.error.set(translate('You can withdraw up to {max}.', { max: formatUsd(this.available()) }));
      return;
    }

    const request: Observable<Account> =
      mode === 'deposit' ? this.accountsApi.deposit(accountId, value) : this.accountsApi.withdraw(accountId, value);
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.mode.set(null);
        this.showDone(mode, value);
        // Cash shows in the header, metrics, chart and order ticket: reload them all.
        this.ordersApi.notifyChanged();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private showDone(mode: Mode, value: number): void {
    clearTimeout(this.doneTimer);
    const amount = formatUsd(value);
    this.done.set(mode === 'deposit' ? translate('Added {amount}', { amount }) : translate('Withdrew {amount}', { amount }));
    this.doneTimer = setTimeout(() => this.done.set(null), 4000);
  }
}
