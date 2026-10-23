import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuditService } from '../../core/api/audit.service';
import { AuthService } from '../../core/api/auth.service';
import { toApiError } from '../../core/api/api-error';
import type { Account, Order } from '../../core/api/models';
import { OpsService } from '../../core/api/ops.service';
import { formatQty, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { ORDER_STATUS_LABELS, statusTone } from '../../shared/order-status';
import { PageHeader } from '../../shared/page-header';

/** How many of the newest orders the page reads. The audit API caps a page at 100. */
const RECENT = 100;
const LATEST = 5;

type Kind = 'frozen' | 'failed' | 'pending';

interface LookRow {
  readonly key: string;
  readonly kind: Kind;
  readonly accountId: number;
  readonly name: string;
  readonly why: string;
  readonly tag: string;
}

/**
 * Operations home for Trading Operations and Super Admin: today's numbers, the
 * accounts that need a look, and the newest orders across the platform.
 *
 * Accounts come from the ops account list. Orders come from the newest page of
 * the audit log, so order counts only cover those orders; the page says so when
 * there are more.
 */
@Component({
  selector: 'leap-ops-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader],
  templateUrl: './ops-page.html',
  styleUrl: './ops-page.scss',
})
export class OpsPage {
  private readonly ops = inject(OpsService);
  private readonly audit = inject(AuditService);
  private readonly auth = inject(AuthService);

  readonly accounts = signal<readonly Account[]>([]);
  readonly orders = signal<readonly Order[]>([]);
  /** True when the audit log holds more orders than the page read. */
  readonly truncated = signal(false);
  /** Latest freeze reason per frozen account. */
  readonly freezeReasons = signal<ReadonlyMap<number, { reason: string; by: string; at: string }>>(new Map());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly loadedAt = signal<Date | null>(null);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = this.auth.me()?.displayName;
    return name ? `${part}, ${name}` : part;
  });

  private readonly nameOf = computed(() => new Map(this.accounts().map((a) => [a.accountId, a.name])));

  private readonly today = computed(() => {
    this.loadedAt();
    return new Date().toDateString();
  });

  private readonly failedToday = computed(() =>
    this.orders().filter((o) => o.status === 'FAILED' && new Date(o.placedTime).toDateString() === this.today()),
  );
  private readonly pending = computed(() => this.orders().filter((o) => o.status === 'PENDING'));
  private readonly frozen = computed(() => this.accounts().filter((a) => a.status === 'FROZEN'));

  readonly kpis = computed(() => {
    const accountsIn = (orders: readonly Order[]) => new Set(orders.map((o) => o.accountId)).size;
    const across = (n: number) => (n === 0 ? 'None right now' : `Across ${n} ${n === 1 ? 'account' : 'accounts'}`);
    const failed = this.failedToday();
    const pending = this.pending();
    return [
      { key: 'accounts', label: 'Accounts', value: this.accounts().length, sub: 'All trading accounts', tone: '', link: '/ops/accounts' },
      { key: 'frozen', label: 'Frozen', value: this.frozen().length, sub: 'New orders rejected', tone: 'info', link: '/ops/accounts' },
      { key: 'failed', label: 'Failed orders today', value: failed.length, sub: across(accountsIn(failed)), tone: 'down', link: '/audit' },
      { key: 'pending', label: 'Pending orders', value: pending.length, sub: across(accountsIn(pending)), tone: 'warn', link: '/audit' },
    ];
  });

  /** Frozen accounts first, then accounts with failed orders today, then accounts with pending orders. */
  readonly look = computed<LookRow[]>(() => {
    const rows: LookRow[] = [];
    const reasons = this.freezeReasons();
    for (const a of this.frozen()) {
      const r = reasons.get(a.accountId);
      const why = r ? `Frozen by ${r.by} on ${formatStamp(r.at)}. ${r.reason}` : 'Frozen. New orders are rejected until it is unfrozen.';
      rows.push({ key: `f${a.accountId}`, kind: 'frozen', accountId: a.accountId, name: a.name, why, tag: 'Frozen' });
    }
    for (const [id, list] of this.byAccount(this.failedToday())) {
      const symbols = [...new Set(list.map((o) => o.symbol))].join(', ');
      const n = list.length;
      rows.push({
        key: `x${id}`,
        kind: 'failed',
        accountId: id,
        name: this.nameOf().get(id) ?? `Account ${id}`,
        why: `${n} ${symbols} ${n === 1 ? 'order' : 'orders'} rejected today, latest at ${formatStamp(list[0].placedTime)}.`,
        tag: `${n} failed`,
      });
    }
    for (const [id, list] of this.byAccount(this.pending())) {
      const n = list.length;
      const oldest = list[list.length - 1];
      rows.push({
        key: `p${id}`,
        kind: 'pending',
        accountId: id,
        name: this.nameOf().get(id) ?? `Account ${id}`,
        why: `${n} ${n === 1 ? 'order' : 'orders'} waiting, the oldest since ${formatStamp(oldest.placedTime)}.`,
        tag: `${n} pending`,
      });
    }
    return rows;
  });

  readonly latest = computed(() =>
    this.orders()
      .slice(0, LATEST)
      .map((o) => ({
        id: o.orderId,
        buy: o.side === 'BUY',
        symbol: o.symbol,
        qty: formatQty(o.quantity),
        account: `${this.nameOf().get(o.accountId) ?? 'Account'} #${o.accountId}`,
        accountId: o.accountId,
        when: formatStamp(o.placedTime),
        value: formatUsd(o.value),
        status: ORDER_STATUS_LABELS[o.status],
        tone: statusTone(o.status),
      })),
  );

  readonly summary = computed(() => {
    const n = this.look().length;
    if (this.loading() && !this.loadedAt()) return 'Loading today’s activity…';
    if (n === 0) return 'Nothing needs a look right now.';
    return `${n} ${n === 1 ? 'item needs' : 'items need'} a look today.`;
  });

  readonly updated = computed(() => {
    const at = this.loadedAt();
    return at ? at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    forkJoin({
      accounts: this.ops.search(),
      page: this.audit.list({ size: RECENT }),
    })
      .pipe(
        switchMap(({ accounts, page }) => {
          const frozen = accounts.filter((a) => a.status === 'FROZEN');
          const reasons$ = frozen.length
            ? forkJoin(
                frozen.map((a) =>
                  this.ops.statusEvents(a.accountId).pipe(
                    map((events) => [a.accountId, latestFreeze(events)] as const),
                    catchError(() => of([a.accountId, null] as const)),
                  ),
                ),
              )
            : of([] as (readonly [number, ReturnType<typeof latestFreeze>])[]);
          return reasons$.pipe(map((reasons) => ({ accounts, page, reasons })));
        }),
      )
      .subscribe({
        next: ({ accounts, page, reasons }) => {
          this.accounts.set(accounts);
          this.orders.set(page.orders);
          this.truncated.set(page.hasNext);
          const found = new Map<number, { reason: string; by: string; at: string }>();
          for (const [id, r] of reasons) if (r) found.set(id, r);
          this.freezeReasons.set(found);
          this.error.set(null);
          this.loadedAt.set(new Date());
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(toApiError(err).message);
          this.loading.set(false);
        },
      });
  }

  /** Orders grouped by account, newest first within each, in order of each account's newest order. */
  private byAccount(orders: readonly Order[]): Map<number, Order[]> {
    const groups = new Map<number, Order[]>();
    for (const o of orders) {
      const list = groups.get(o.accountId);
      if (list) list.push(o);
      else groups.set(o.accountId, [o]);
    }
    return groups;
  }
}

/** The newest FREEZE event, as who froze it, when, and why. */
function latestFreeze(events: readonly Record<string, unknown>[]): { reason: string; by: string; at: string } | null {
  const freezes = events
    .filter((e) => e['action'] === 'FREEZE')
    .sort((a, b) => String(b['occurredAt']).localeCompare(String(a['occurredAt'])));
  const e = freezes[0];
  if (!e) return null;
  return { reason: String(e['reason'] ?? ''), by: String(e['actorUsername'] ?? 'ops'), at: String(e['occurredAt'] ?? '') };
}
