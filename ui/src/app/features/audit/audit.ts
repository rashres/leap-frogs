import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuditService } from '../../core/api/audit.service';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Account, AuditOrderPage, Order } from '../../core/api/models';
import { OpsService } from '../../core/api/ops.service';
import { Icon } from '../../shared/icon';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { PageHeader } from '../../shared/page-header';
import { formatPrice, formatQty, formatStamp, formatUsd } from '../../shared/format';
import { TPipe } from '../../core/i18n/t.pipe';
import { translate } from '../../core/i18n/i18n.service';

interface Step {
  readonly state: string;
  readonly at: string;
  readonly detail: string;
}

@Component({
  selector: 'leap-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, Icon, PageHeader],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class Audit {
  private readonly auditApi = inject(AuditService);
  private readonly opsApi = inject(OpsService);

  /** Every trading account, for the account search suggestions. */
  readonly accounts = toSignal(this.opsApi.search().pipe(catchError(() => of([] as Account[]))), { initialValue: [] as Account[] });
  /** What is typed in the account search box. */
  readonly accountQuery = signal('');
  /** The account the search resolves to: a "#12" / "12" id, or an exact name or email. Empty means all accounts. */
  readonly accountId = computed(() => {
    const query = this.accountQuery().trim();
    if (!query) return '';
    const id = /^#?(\d+)$/.exec(query)?.[1] ?? /#(\d+)$/.exec(query)?.[1];
    if (id) return id;
    const lower = query.toLowerCase();
    const matches = this.accounts().filter((a) => a.name.toLowerCase() === lower || a.email?.toLowerCase() === lower);
    return matches.length === 1 ? String(matches[0].accountId) : null;
  });
  readonly accountUnmatched = computed(() => this.accountId() === null);
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly page = signal<AuditOrderPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly expanded = signal<number | null>(null);
  readonly rows = computed(() => this.page()?.orders.map((order) => this.toRow(order)) ?? []);
  readonly pageButtons = computed(() => {
    const result = this.page();
    if (!result || result.totalPages <= 1) return [];
    const first = Math.max(0, Math.min(result.page - 2, result.totalPages - 5));
    return Array.from({ length: Math.min(5, result.totalPages) }, (_, index) => first + index);
  });

  constructor() {
    // "Open in Audit" on an account page links here with ?account=<id>.
    const account = inject(ActivatedRoute).snapshot.queryParamMap.get('account');
    if (account && /^\d+$/.test(account)) this.accountQuery.set(`#${account}`);
    this.load();
  }

  load(page = 0): void {
    if (this.accountUnmatched()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auditApi
      .list({
        accountId: this.accountId() ? Number(this.accountId()) : null,
        startDate: this.startDate() || null,
        endDate: this.endDate() || null,
        page,
      })
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.page.set(null);
          this.error.set(toApiError(error));
          this.loading.set(false);
        },
      });
  }

  setAccount(event: Event): void {
    this.accountQuery.set((event.target as HTMLInputElement).value);
  }

  setStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  setEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.accountQuery.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.load();
  }

  goToPage(page: number): void {
    const result = this.page();
    if (result == null || page < 0 || page >= result.totalPages || page === result.page || this.loading()) return;
    this.load(page);
  }

  toggle(orderId: number): void {
    this.expanded.update((current) => (current === orderId ? null : orderId));
  }

  toggleFromButton(event: Event, orderId: number): void {
    event.stopPropagation();
    this.toggle(orderId);
  }

  formatStamp(value: string): string {
    return formatStamp(value);
  }

  formatPrice(value: number): string {
    return formatPrice(value);
  }

  formatQty(value: number): string {
    return formatQty(value);
  }

  formatUsd(value: number): string {
    return formatUsd(value);
  }

  statusLabel(status: Order['status']): string {
    return translate(ORDER_STATUS_LABELS[status]);
  }

  statusTone(status: Order['status']): string {
    return statusTone(status);
  }

  private toRow(order: Order) {
    const filled = order.status === 'COMPLETE';
    const waiting =
      order.limitPrice != null
        ? translate('Waiting until {price} or better.', { price: this.formatPrice(order.limitPrice) })
        : translate('Waiting for the market to open.');
    const steps: Step[] = [
      {
        state: translate('Submitted'),
        at: this.formatStamp(order.placedTime),
        detail: translate('{side} {qty} {symbol} recorded for account #{account}.', {
          side: translate(order.side === 'BUY' ? 'Buy' : 'Sell'),
          qty: this.formatQty(order.quantity),
          symbol: order.symbol,
          account: order.accountId,
        }),
      },
    ];
    if (filled) {
      const waited = order.fulfilledTime != null && Date.parse(order.fulfilledTime) - Date.parse(order.placedTime) > 1000;
      steps.push({
        state: translate(waited ? 'Pending → Filled' : 'Submitted → Filled'),
        at: order.fulfilledTime ? this.formatStamp(order.fulfilledTime) : '',
        detail: translate('Executed at {price}; cash and holdings updated.', { price: this.formatPrice(order.price) }),
      });
    } else if (order.status === 'FAILED') {
      steps.push({
        state: translate('Submitted → Rejected'),
        at: this.formatStamp(order.placedTime),
        detail: translate('Failed the cash or holdings check. The rejection reason is not recorded.'),
      });
    } else if (order.status === 'PENDING') {
      steps.push({
        state: translate('Pending'),
        at: this.formatStamp(order.placedTime),
        detail: `${waiting} ${order.expiresAt ? translate('Expires {time}.', { time: this.formatStamp(order.expiresAt) }) : translate('Open until filled or cancelled.')}`,
      });
    } else if (order.status === 'CANCELLED') {
      steps.push({ state: translate('Pending → Cancelled'), at: '', detail: translate('Cancelled before it filled; nothing was traded.') });
    } else if (order.status === 'EXPIRED') {
      steps.push({
        state: translate('Pending → Expired'),
        at: order.expiresAt ? this.formatStamp(order.expiresAt) : '',
        detail: translate('A day order that did not fill before its session closed; nothing was traded.'),
      });
    }
    return {
      ...order,
      submitted: this.formatStamp(order.placedTime),
      quantityLabel: this.formatQty(order.quantity),
      priceLabel: this.formatPrice(order.price),
      valueLabel: this.formatUsd(order.value),
      balanceUpdatedLabel: this.formatUsd(order.balanceUpdatedTo),
      statusLabel: this.statusLabel(order.status),
      tone: this.statusTone(order.status),
      steps,
    };
  }

}
