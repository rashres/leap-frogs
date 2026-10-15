import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import type { CopySubscription, CopyTrader } from '../../core/api/models';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';

/**
 * Copy / Copying / Stop for one lead trader, acting as the active account.
 * Copy opens a small amount form; `changed` fires after following or stopping.
 */
@Component({
  selector: 'leap-copy-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (isSelf()) {
      <span class="pill pill-muted">This is you</span>
    } @else if (subscription(); as sub) {
      <div class="row">
        <span class="pill pill-up"><leap-icon name="check" [size]="14" />Copying · {{ formatUsd(sub.allocation) }}</span>
        @if (allowStop()) {
          <button type="button" class="btn btn-secondary btn-sm" [disabled]="busy()" (click)="stop(sub.subscriptionId)">
            {{ busy() ? 'Stopping…' : 'Stop copying' }}
          </button>
        }
      </div>
    } @else if (open()) {
      <form class="form" (submit)="confirm($event)">
        <label class="field-label" [for]="inputId()">Amount to allocate</label>
        <div class="amount">
          <span class="currency" aria-hidden="true">$</span>
          <input
            class="control num"
            type="number"
            min="1"
            step="any"
            inputmode="decimal"
            [id]="inputId()"
            [value]="amount()"
            (input)="onInput($event)"
          />
        </div>
        <div class="quick" role="group" aria-label="Quick amounts">
          @for (pct of quickPercents; track pct) {
            <button type="button" (click)="setPercent(pct)">{{ pct }}%</button>
          }
        </div>
        <p class="hint">
          {{ formatUsd(cash()) }} cash available. Only {{ trader().name }}'s new trades are copied, scaled to this amount.
        </p>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <div class="row end">
          <button type="button" class="btn btn-secondary btn-sm" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">
            {{ busy() ? 'Starting…' : 'Start copying' }}
          </button>
        </div>
      </form>
    } @else {
      <button type="button" class="btn btn-primary btn-sm" [disabled]="account.activeId() == null" (click)="start()">
        <leap-icon name="copy" [size]="16" />Copy
      </button>
    }
    @if (stopError(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .row.end {
        justify-content: flex-end;
      }
      .btn leap-icon {
        margin-right: 6px;
      }
      .pill leap-icon {
        margin-right: -2px;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 240px;
      }
      .amount {
        position: relative;
      }
      .currency {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-3);
        font-size: 14px;
      }
      .amount .control {
        padding-left: 28px;
      }
      .quick {
        display: flex;
        gap: 6px;
      }
      .quick button {
        flex: 1;
        height: 28px;
        border-radius: 6px;
        border: 1px solid var(--border-soft);
        background: var(--panel-2);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-2);
      }
      .quick button:hover {
        color: var(--accent);
        border-color: var(--accent);
      }
      .hint {
        margin: 0;
        font-size: 12.5px;
        color: var(--text-3);
      }
      .error {
        margin: 6px 0 0;
        font-size: 13px;
        color: var(--down);
      }
    `,
  ],
})
export class CopyControl {
  private readonly api = inject(CopyTradingService);
  protected readonly account = inject(ActiveAccountService);

  readonly trader = input.required<CopyTrader>();
  /** The active account's subscription to this trader, if it copies them. */
  readonly subscription = input<CopySubscription | undefined>(undefined);
  /** Show a Stop copying button next to "Copying". */
  readonly allowStop = input(false);
  readonly changed = output<void>();

  readonly quickPercents = [10, 25, 50] as const;
  readonly open = signal(false);
  readonly amount = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly stopError = signal<string | null>(null);

  readonly cash = computed(() => this.account.active()?.cashBalance ?? 0);
  readonly isSelf = computed(() => this.trader().accountId === this.account.activeId());
  readonly inputId = computed(() => `copy-amount-${this.trader().copyTraderId}`);

  protected readonly formatUsd = formatUsd;

  start(): void {
    this.error.set(null);
    this.setPercent(25);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.error.set(null);
  }

  /** A share of the cash balance, rounded down to the nearest $100. */
  setPercent(pct: number): void {
    const value = Math.floor((this.cash() * pct) / 100 / 100) * 100;
    this.amount.set(value > 0 ? String(value) : '');
  }

  onInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
  }

  confirm(event: Event): void {
    event.preventDefault();
    const accountId = this.account.activeId();
    const amount = Number(this.amount());
    if (accountId == null || this.busy()) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      this.error.set('Enter an amount greater than $0.');
      return;
    }
    if (amount > this.cash()) {
      this.error.set(`That is more than your cash balance of ${formatUsd(this.cash())}.`);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.follow(accountId, this.trader().copyTraderId, amount).subscribe({
      next: () => {
        this.busy.set(false);
        this.open.set(false);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(error).message);
      },
    });
  }

  stop(subscriptionId: number): void {
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    this.busy.set(true);
    this.stopError.set(null);
    this.api.unfollow(accountId, subscriptionId).subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.stopError.set(toApiError(error).message);
      },
    });
  }
}
