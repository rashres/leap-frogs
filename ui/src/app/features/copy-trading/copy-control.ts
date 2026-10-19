import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type WritableSignal } from '@angular/core';
import type { Observable } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { CopyTradingService } from '../../core/api/copy-trading.service';
import type { CopySettings, CopySubscription, CopyTrader } from '../../core/api/models';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';

type Mode = 'closed' | 'follow' | 'edit';

/** An optional positive number from a text box: null when empty, NaN when invalid. */
function optionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : NaN;
}

/**
 * Copy / Copying / Paused for one lead trader, acting as the active account.
 * Copy opens a settings form (amount, plus optional max per trade and
 * stop-loss); with `allowStop`, a copy can also be edited, paused, resumed and
 * stopped. `changed` fires after any of those.
 */
@Component({
  selector: 'leap-copy-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (isSelf()) {
      <span class="pill pill-muted">This is you</span>
    } @else if (mode() !== 'closed') {
      <form class="form" (submit)="submit($event)">
        <label class="field-label" [for]="inputId()">{{ mode() === 'edit' ? 'Allocation' : 'Amount to allocate' }}</label>
        <div class="amount">
          <span class="affix" aria-hidden="true">$</span>
          <input
            class="control num"
            type="number"
            min="1"
            step="any"
            inputmode="decimal"
            [id]="inputId()"
            [value]="amount()"
            (input)="amount.set(value($event))"
          />
        </div>
        @if (mode() === 'follow') {
          <div class="quick" role="group" aria-label="Quick amounts">
            @for (pct of quickPercents; track pct) {
              <button type="button" (click)="setPercent(pct)">{{ pct }}%</button>
            }
          </div>
          <p class="hint">
            {{ formatUsd(cash()) }} cash available. Only {{ trader().name }}'s new trades are copied, scaled to this amount.
            Buys stop once this much is invested.
          </p>
        } @else if (subscription(); as sub) {
          <p class="hint">{{ formatUsd(sub.invested) }} invested · {{ formatUsd(sub.budgetLeft) }} left to copy buys with.</p>
        }

        <button type="button" class="toggle" [attr.aria-expanded]="showLimits()" (click)="showLimits.set(!showLimits())">
          <leap-icon [name]="showLimits() ? 'chevron-down' : 'chevron-right'" [size]="14" />Limits
          @if (!showLimits() && limitsSummary(); as summary) {
            <span class="faint">· {{ summary }}</span>
          }
        </button>
        @if (showLimits()) {
          <div class="limits">
            <label class="field-label" [for]="inputId() + '-max'">Max per trade</label>
            <div class="amount">
              <span class="affix" aria-hidden="true">$</span>
              <input
                class="control num"
                type="number"
                min="1"
                step="any"
                inputmode="decimal"
                placeholder="No cap"
                [id]="inputId() + '-max'"
                [value]="maxPerTrade()"
                (input)="maxPerTrade.set(value($event))"
              />
            </div>
            <p class="hint">No single copied buy will cost more than this.</p>

            <label class="field-label" [for]="inputId() + '-stop'">Stop-loss</label>
            <div class="amount">
              <input
                class="control num suffixed"
                type="number"
                min="1"
                max="100"
                step="any"
                inputmode="decimal"
                placeholder="None"
                [id]="inputId() + '-stop'"
                [value]="stopLoss()"
                (input)="stopLoss.set(value($event))"
              />
              <span class="affix right" aria-hidden="true">%</span>
            </div>
            <p class="hint">Pause copying once this copy has lost this much of its allocation.</p>
            <label class="check" [class.off]="!stopLoss().trim()">
              <input type="checkbox" [checked]="sellOnStopLoss()" [disabled]="!stopLoss().trim()" (change)="sellOnStopLoss.set(checked($event))" />
              Also sell this copy's shares when it hits
            </label>
          </div>
        }

        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <div class="row end">
          <button type="button" class="btn btn-secondary btn-sm" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">
            @if (mode() === 'edit') {
              {{ busy() ? 'Saving…' : 'Save' }}
            } @else {
              {{ busy() ? 'Starting…' : 'Start copying' }}
            }
          </button>
        </div>
      </form>
    } @else if (subscription(); as sub) {
      <div class="row">
        @if (sub.pauseReason === 'STOP_LOSS') {
          <span class="pill pill-down" title="This copy lost {{ sub.stopLossPercent }}% of its allocation">Stop-loss hit · {{ formatUsd(sub.allocation) }}</span>
        } @else if (sub.paused) {
          <span class="pill pill-muted">Paused · {{ formatUsd(sub.allocation) }}</span>
        } @else {
          <span class="pill pill-up"><leap-icon name="check" [size]="14" />Copying · {{ formatUsd(sub.allocation) }}</span>
        }
        @if (allowStop()) {
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy()" (click)="edit(sub)">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="busy()" (click)="setPaused(sub, !sub.paused)">
            {{ sub.paused ? 'Resume' : 'Pause' }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" [disabled]="busy()" (click)="stop(sub.subscriptionId)">
            {{ busy() ? 'Working…' : 'Stop copying' }}
          </button>
        }
      </div>
    } @else {
      <button type="button" class="btn btn-primary btn-sm" [disabled]="account.activeId() == null" (click)="start()">
        <leap-icon name="copy" [size]="16" />Copy
      </button>
    }
    @if (actionError(); as message) {
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
        text-align: left;
      }
      .amount {
        position: relative;
      }
      .affix {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-3);
        font-size: 14px;
      }
      .affix.right {
        left: auto;
        right: 14px;
      }
      .amount .control {
        padding-left: 28px;
      }
      .amount .control.suffixed {
        padding-left: 14px;
        padding-right: 28px;
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
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        align-self: flex-start;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-2);
      }
      .toggle:hover {
        color: var(--text);
      }
      .limits {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border: 1px solid var(--border-soft);
        border-radius: var(--radius);
        background: var(--panel-2);
      }
      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-2);
      }
      .check.off {
        color: var(--text-3);
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
  /** Show Edit, Pause / Resume and Stop copying next to the copy's status. */
  readonly allowStop = input(false);
  readonly changed = output<void>();

  readonly quickPercents = [10, 25, 50] as const;
  readonly mode = signal<Mode>('closed');
  readonly amount = signal('');
  readonly maxPerTrade = signal('');
  readonly stopLoss = signal('');
  readonly sellOnStopLoss = signal(false);
  readonly showLimits = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly cash = computed(() => this.account.active()?.cashBalance ?? 0);
  readonly isSelf = computed(() => this.trader().accountId === this.account.activeId());
  readonly inputId = computed(() => `copy-amount-${this.trader().copyTraderId}`);

  /** The limits in a few words, shown while the section is collapsed. */
  readonly limitsSummary = computed(() => {
    const parts: string[] = [];
    if (this.maxPerTrade().trim()) parts.push(`max ${formatUsd(Number(this.maxPerTrade()))} a trade`);
    if (this.stopLoss().trim()) parts.push(`stop-loss ${this.stopLoss().trim()}%`);
    return parts.join(', ');
  });

  protected readonly formatUsd = formatUsd;

  start(): void {
    this.reset();
    this.setPercent(25);
    this.mode.set('follow');
  }

  edit(sub: CopySubscription): void {
    this.reset();
    this.amount.set(String(sub.allocation));
    this.maxPerTrade.set(sub.maxPerTrade != null ? String(sub.maxPerTrade) : '');
    this.stopLoss.set(sub.stopLossPercent != null ? String(sub.stopLossPercent) : '');
    this.sellOnStopLoss.set(sub.sellOnStopLoss);
    this.showLimits.set(true);
    this.mode.set('edit');
  }

  close(): void {
    this.mode.set('closed');
    this.error.set(null);
  }

  /** A share of the cash balance, rounded down to the nearest $100. */
  setPercent(pct: number): void {
    const value = Math.floor((this.cash() * pct) / 100 / 100) * 100;
    this.amount.set(value > 0 ? String(value) : '');
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  submit(event: Event): void {
    event.preventDefault();
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    const settings = this.readSettings();
    if (!settings) return;

    const sub = this.subscription();
    if (this.mode() === 'edit' && sub) {
      this.send(this.api.updateSettings(accountId, sub.subscriptionId, { ...settings, paused: sub.paused }), this.error);
      return;
    }
    if (settings.allocation > this.cash()) {
      this.error.set(`That is more than your cash balance of ${formatUsd(this.cash())}.`);
      return;
    }
    this.send(this.api.follow(accountId, this.trader().copyTraderId, settings), this.error);
  }

  setPaused(sub: CopySubscription, paused: boolean): void {
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    const settings: CopySettings = {
      allocation: sub.allocation,
      maxPerTrade: sub.maxPerTrade,
      stopLossPercent: sub.stopLossPercent,
      sellOnStopLoss: sub.sellOnStopLoss,
    };
    this.send(this.api.updateSettings(accountId, sub.subscriptionId, { ...settings, paused }), this.actionError);
  }

  stop(subscriptionId: number): void {
    const accountId = this.account.activeId();
    if (accountId == null || this.busy()) return;
    this.send(this.api.unfollow(accountId, subscriptionId), this.actionError);
  }

  /** The form's settings, or null (with an error shown) when something is invalid. */
  private readSettings(): CopySettings | null {
    const allocation = Number(this.amount());
    if (!Number.isFinite(allocation) || allocation <= 0) {
      this.error.set('Enter an amount greater than $0.');
      return null;
    }
    const maxPerTrade = optionalNumber(this.maxPerTrade());
    if (Number.isNaN(maxPerTrade)) {
      this.error.set('Max per trade must be greater than $0, or empty for no cap.');
      this.showLimits.set(true);
      return null;
    }
    const stopLossPercent = optionalNumber(this.stopLoss());
    if (Number.isNaN(stopLossPercent) || (stopLossPercent != null && stopLossPercent > 100)) {
      this.error.set('Stop-loss must be between 0 and 100%, or empty for none.');
      this.showLimits.set(true);
      return null;
    }
    return { allocation, maxPerTrade, stopLossPercent, sellOnStopLoss: stopLossPercent != null && this.sellOnStopLoss() };
  }

  /** Sends a change; closes the form and emits `changed` on success, or shows the API's message in `errors`. */
  private send(request: Observable<unknown>, errors: WritableSignal<string | null>): void {
    this.busy.set(true);
    this.error.set(null);
    this.actionError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.mode.set('closed');
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        errors.set(toApiError(error).message);
      },
    });
  }

  private reset(): void {
    this.error.set(null);
    this.actionError.set(null);
    this.amount.set('');
    this.maxPerTrade.set('');
    this.stopLoss.set('');
    this.sellOnStopLoss.set(false);
    this.showLimits.set(false);
  }
}
