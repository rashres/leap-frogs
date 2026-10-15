import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuditService } from '../../core/api/audit.service';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { AuditOrderPage, Order } from '../../core/api/models';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { Icon } from '../../shared/icon';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { PageHeader } from '../../shared/page-header';
import { formatPrice, formatQty, formatStamp, formatUsd } from '../../shared/format';

@Component({
  selector: 'leap-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PageHeader],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class Audit {
  protected readonly account = inject(ActiveAccountService);
  private readonly auditApi = inject(AuditService);

  readonly accountId = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly page = signal<AuditOrderPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly rows = computed(() => this.page()?.orders.map((order) => this.toRow(order)) ?? []);
  readonly pageButtons = computed(() => {
    const result = this.page();
    if (!result || result.totalPages <= 1) return [];
    const first = Math.max(0, Math.min(result.page - 2, result.totalPages - 5));
    return Array.from({ length: Math.min(5, result.totalPages) }, (_, index) => first + index);
  });

  constructor() {
    this.load();
  }

  load(page = 0): void {
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
    this.accountId.set((event.target as HTMLSelectElement).value);
  }

  setStartDate(event: Event): void {
    this.startDate.set((event.target as HTMLInputElement).value);
  }

  setEndDate(event: Event): void {
    this.endDate.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.accountId.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.load();
  }

  goToPage(page: number): void {
    const result = this.page();
    if (result == null || page < 0 || page >= result.totalPages || page === result.page || this.loading()) return;
    this.load(page);
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
    return ORDER_STATUS_LABELS[status];
  }

  statusTone(status: Order['status']): string {
    return statusTone(status);
  }

  private toRow(order: Order) {
    return {
      ...order,
      submitted: this.formatStamp(order.placedTime),
      quantityLabel: this.formatQty(order.quantity),
      priceLabel: this.formatPrice(order.price),
      valueLabel: this.formatUsd(order.value),
      statusLabel: this.statusLabel(order.status),
      tone: this.statusTone(order.status),
    };
  }

}
