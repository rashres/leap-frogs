import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { AccountsService } from '../../core/api/accounts.service';
import { toApiError } from '../../core/api/api-error';
import { OrdersService } from '../../core/api/orders.service';
import { tk, translate } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';

/** The API takes up to this much in one deposit. */
const MAX_DEPOSIT = 1_000_000;
const QUICK = [100, 1_000, 10_000] as const;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * "Add cash" next to the Available cash figure: a small form that posts a
 * deposit to /api/accounts/{id}/deposits, then refreshes everything that shows
 * cash. A frozen account takes no deposits, so the button is turned off.
 */
@Component({
  selector: 'leap-add-cash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, Icon],
  host: {
    '(document:keydown.escape)': 'close()',
    '(document:click)': 'closeOutside($event)',
  },
  template: `
    <button
      type="button"
      class="btn btn-secondary btn-sm add-btn"
      [disabled]="frozen() || account.activeId() == null"
      [attr.title]="frozen() ? ('This account is frozen, so cash cannot be added.' | t) : null"
      aria-controls="add-cash-panel"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <leap-icon name="plus" [size]="14" />{{ 'Add cash' | t }}
    </button>

    @if (open()) {
      <form class="pop" id="add-cash-panel" [attr.aria-label]="'Add cash' | t" (submit)="submit($event)" novalidate>
        <label class="field-label" for="add-cash-amount">{{ 'Amount (USD)' | t }}</label>
        <div class="amount" [class.bad]="error()">
          <span class="affix" aria-hidden="true">$</span>
          <input
            id="add-cash-amount"
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
          @for (q of quick; track q) {
            <button type="button" (click)="setAmount(q.toString())">+{{ usd(q) }}</button>
          }
        </div>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message | t }}</p>
        }
        <div class="actions">
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">{{ 'Cancel' | t }}</button>
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">{{ (busy() ? 'Adding…' : 'Add cash') | t }}</button>
        </div>
        <p class="note">{{ 'Cash is added straight away. Up to {max} at a time.' | t: { max: usd(max) } }}</p>
      </form>
    }

    @if (added(); as text) {
      <p class="added" role="status">{{ text }}</p>
    }
  `,
  styles: [
    `
      :host {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .add-btn {
        gap: 4px;
        height: 26px;
        padding: 0 9px;
        font-size: 12px;
      }
      .pop {
        position: absolute;
        z-index: 30;
        top: calc(100% + 6px);
        right: 0;
        width: 270px;
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
      .added {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--up);
      }
      @media (max-width: 560px) {
        .pop {
          right: auto;
          left: 0;
          width: min(270px, calc(100vw - 48px));
        }
      }
    `,
  ],
})
export class AddCash {
  protected readonly account = inject(ActiveAccountService);
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly quick = QUICK;
  protected readonly max = MAX_DEPOSIT;
  protected readonly usd = (value: number) => formatUsd(value);

  readonly open = signal(false);
  readonly amount = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  /** "Added $500.00" for a few seconds after a deposit. */
  readonly added = signal<string | null>(null);
  readonly frozen = computed(() => this.account.active()?.status === 'FROZEN');

  private addedTimer: ReturnType<typeof setTimeout> | undefined;

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.amount.set('');
    this.error.set(null);
    this.open.set(true);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>('#add-cash-amount')?.focus());
  }

  close(): void {
    this.open.set(false);
  }

  closeOutside(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  setAmount(text: string): void {
    this.amount.set(text);
    this.error.set(null);
  }

  submit(event: Event): void {
    event.preventDefault();
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    const text = this.amount().trim().replace(/,/g, '');
    const value = Number(text);
    if (!AMOUNT.test(text) || !(value > 0)) {
      this.error.set(tk('Enter an amount above $0 with at most 2 decimal places.'));
      return;
    }
    if (value > MAX_DEPOSIT) {
      this.error.set(translate('You can add up to {max} at a time.', { max: formatUsd(MAX_DEPOSIT) }));
      return;
    }
    this.busy.set(true);
    this.accountsApi.deposit(accountId, value).subscribe({
      next: () => {
        this.busy.set(false);
        this.open.set(false);
        this.showAdded(value);
        // Cash shows in the header, metrics, chart and order ticket: reload them all.
        this.ordersApi.notifyChanged();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private showAdded(value: number): void {
    clearTimeout(this.addedTimer);
    this.added.set(translate('Added {amount}', { amount: formatUsd(value) }));
    this.addedTimer = setTimeout(() => this.added.set(null), 4000);
  }
}
