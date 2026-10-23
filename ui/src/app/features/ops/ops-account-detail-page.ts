import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { AccountsService } from '../../core/api/accounts.service';
import { OrdersService } from '../../core/api/orders.service';
import { OpsService } from '../../core/api/ops.service';
import { toApiError } from '../../core/api/api-error';
import type { Account, Holding, Order } from '../../core/api/models';
import { formatPrice, formatQty, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { ORDER_STATUS_GLYPH, ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';

const ORDERS_PER_PAGE = 25;

@Component({
  selector: 'leap-ops-account-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, InstrumentLogo],
  templateUrl: './ops-account-detail-page.html',
  styleUrl: './ops-account-detail-page.scss',
})
export class OpsAccountDetailPage {
  private readonly accountsApi = inject(AccountsService);
  private readonly ordersApi = inject(OrdersService);
  private readonly ops = inject(OpsService);

  /** Route param. */
  readonly id = input.required<number>();

  readonly reason = signal('');
  readonly busy = signal(false);
  readonly flash = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly confirmFreeze = signal(false);
  private readonly tick = signal(0);

  private readonly bundle$ = combineLatest([toObservable(this.id), toObservable(this.tick)]).pipe(
    switchMap(([id]) =>
      combineLatest({
        account: this.accountsApi.get(id).pipe(catchError(() => of(null))),
        holdings: this.accountsApi.holdings(id).pipe(catchError(() => of([] as Holding[]))),
        orders: this.ordersApi.list(id).pipe(catchError(() => of([] as Order[]))),
        events: this.ops.statusEvents(id).pipe(catchError(() => of([] as readonly Record<string, unknown>[]))),
      }),
    ),
  );

  readonly bundle = toSignal(this.bundle$, {
    initialValue: {
      account: null as Account | null,
      holdings: [] as Holding[],
      orders: [] as Order[],
      events: [] as readonly Record<string, unknown>[],
    },
  });

  readonly account = computed(() => this.bundle().account);
  readonly holdings = computed(() => this.bundle().holdings);
  /** Orders are shown a page at a time; `page` is zero-based. */
  readonly page = linkedSignal({ source: this.id, computation: () => 0 });
  readonly orderCount = computed(() => this.bundle().orders.length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.orderCount() / ORDERS_PER_PAGE)));
  readonly orders = computed(() => {
    const start = this.page() * ORDERS_PER_PAGE;
    return this.bundle().orders.slice(start, start + ORDERS_PER_PAGE);
  });
  /** Up to five page numbers around the current one. */
  readonly pageButtons = computed(() => {
    const total = this.totalPages();
    if (total <= 1) return [];
    const first = Math.max(0, Math.min(this.page() - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, index) => first + index);
  });
  readonly frozen = computed(() => this.account()?.status === 'FROZEN');
  protected readonly glyph = ORDER_STATUS_GLYPH;
  protected readonly label = ORDER_STATUS_LABELS;

  /** Freeze and unfreeze events, newest first. */
  readonly history = computed(() =>
    [...this.bundle().events]
      .sort((a, b) => String(b['occurredAt']).localeCompare(String(a['occurredAt'])))
      .map((e) => ({
        frozen: e['action'] === 'FREEZE',
        by: String(e['actorUsername'] ?? 'ops'),
        at: this.stamp(e['occurredAt']),
        reason: e['reason'] ? String(e['reason']) : '',
      })),
  );

  /** Today's failed orders as a one-line warning, or null when there are none. */
  readonly failedNote = computed(() => {
    const today = new Date().toDateString();
    const failed = this.bundle().orders.filter((o) => o.status === 'FAILED' && new Date(o.placedTime).toDateString() === today);
    const n = failed.length;
    if (n === 0) return null;
    const newest = failed.reduce((a, b) => (a.placedTime > b.placedTime ? a : b));
    const symbols = [...new Set(failed.map((o) => o.symbol))];
    const sides = new Set(failed.map((o) => o.side));
    const side = sides.size > 1 ? 'orders' : newest.side === 'BUY' ? 'buys' : 'sells';
    if (n === 1) {
      return { head: '1 failed order today.', rest: `The ${newest.symbol} ${side.slice(0, -1)} at ${clock(newest.placedTime)} was rejected.` };
    }
    const what = symbols.length === 1 ? `${n === 2 ? 'Both' : `All ${n}`} ${symbols[0]} ${side}` : `${n} ${side} (${symbols.join(', ')})`;
    return { head: `${n} failed orders today.`, rest: `${what} were rejected, the latest at ${clock(newest.placedTime)}.` };
  });

  cash(a: Account | null): string {
    return a ? formatUsd(a.cashBalance) : '—';
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  /** "Market · Day" or "Limit $182.00 · GTC". */
  typeOf(o: Order): string {
    const type = o.orderType === 'LIMIT' ? `Limit ${formatPrice(o.limitPrice)}` : 'Market';
    return `${type} · ${o.timeInForce === 'GTC' ? 'GTC' : 'Day'}`;
  }

  tone(o: Order): string {
    return statusTone(o.status);
  }

  qty(value: number): string {
    return formatQty(value);
  }

  price(value: number): string {
    return formatPrice(value);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
  }

  stamp(value: unknown): string {
    return formatStamp(value as string | null | undefined);
  }

  freeze(): void {
    const reason = this.reason().trim();
    if (!reason) {
      this.error.set('Enter a reason to freeze this account.');
      return;
    }
    this.busy.set(true);
    this.ops.freeze(this.id(), reason).subscribe({
      next: (a) => {
        this.busy.set(false);
        this.confirmFreeze.set(false);
        this.reason.set('');
        this.flash.set(`Account ${a.accountId} frozen.`);
        this.error.set(null);
        this.tick.update((n) => n + 1);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  unfreeze(): void {
    this.busy.set(true);
    this.ops.unfreeze(this.id()).subscribe({
      next: (a) => {
        this.busy.set(false);
        this.flash.set(`Account ${a.accountId} unfrozen.`);
        this.error.set(null);
        this.tick.update((n) => n + 1);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}

/** "1:30 PM". */
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
