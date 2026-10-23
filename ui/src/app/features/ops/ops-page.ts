import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AuditService } from '../../core/api/audit.service';
import { AuthService } from '../../core/api/auth.service';
import { toApiError } from '../../core/api/api-error';
import type { Account, Order, OrderStatus } from '../../core/api/models';
import { OpsService } from '../../core/api/ops.service';
import { I18nService, fill } from '../../core/i18n/i18n.service';
import { formatQty } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { statusTone } from '../../shared/order-status';
import { PageHeader } from '../../shared/page-header';
import { OPS_TEXT, type OpsText } from './ops-page.i18n';

/** How many of the newest orders the page reads. The audit API caps a page at 100. */
const RECENT = 100;
const LATEST = 5;

type Kind = 'frozen' | 'failed' | 'pending';

/** Glyphs keep each state readable without relying on colour. */
const GLYPH: Readonly<Record<Kind, string>> = { frozen: '❄', failed: '✕', pending: '◷' };
const STATUS_GLYPH: Readonly<Record<OrderStatus, string>> = {
  CREATED: '◷',
  PENDING: '◷',
  COMPLETE: '✓',
  FAILED: '✕',
  CANCELLED: '–',
  EXPIRED: '⌛',
};

interface LookRow {
  readonly key: string;
  readonly kind: Kind;
  readonly accountId: number;
  readonly name: string;
  readonly why: string;
  readonly tag: string;
  readonly glyph: string;
}

interface FreezeNote {
  readonly reason: string;
  readonly by: string;
  readonly at: string;
}

/**
 * Operations home for Trading Operations and Super Admin: today's numbers, the
 * accounts that need a look, and the newest orders across the platform.
 *
 * Accounts come from the ops account list. Orders come from the newest page of
 * the audit log, so order counts only cover those orders; the page says so when
 * there are more. Words come from ops-page.i18n.ts in the chosen language.
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
  private readonly i18n = inject(I18nService);

  /** Page words in the chosen language. */
  readonly t = computed<OpsText>(() => OPS_TEXT[this.i18n.lang()]);

  readonly accounts = signal<readonly Account[]>([]);
  readonly orders = signal<readonly Order[]>([]);
  /** True when the audit log holds more orders than the page read. */
  readonly truncated = signal(false);
  /** Latest freeze note per frozen account. */
  readonly freezeNotes = signal<ReadonlyMap<number, FreezeNote>>(new Map());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly loadedAt = signal<Date | null>(null);

  readonly greeting = computed(() => {
    const t = this.t();
    const hour = new Date().getHours();
    const name = this.auth.me()?.displayName;
    if (!name) return t.greetingNoName;
    return fill(hour < 12 ? t.morning : hour < 18 ? t.afternoon : t.evening, { name });
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
    const t = this.t();
    const accountsIn = (orders: readonly Order[]) => new Set(orders.map((o) => o.accountId)).size;
    const across = (n: number) => (n === 0 ? t.noneNow : n === 1 ? t.acrossOne : fill(t.across, { n }));
    const failed = this.failedToday();
    const pending = this.pending();
    return [
      { key: 'accounts', label: t.kAccounts, value: this.accounts().length, sub: t.kAccountsSub, tone: '', glyph: '', link: '/ops/accounts' },
      { key: 'frozen', label: t.kFrozen, value: this.frozen().length, sub: t.kFrozenSub, tone: 'info', glyph: GLYPH.frozen, link: '/ops/accounts' },
      { key: 'failed', label: t.kFailed, value: failed.length, sub: across(accountsIn(failed)), tone: 'down', glyph: GLYPH.failed, link: '/audit' },
      { key: 'pending', label: t.kPending, value: pending.length, sub: across(accountsIn(pending)), tone: 'warn', glyph: GLYPH.pending, link: '/audit' },
    ];
  });

  /** Frozen accounts first, then accounts with failed orders today, then accounts with pending orders. */
  readonly look = computed<LookRow[]>(() => {
    const t = this.t();
    const rows: LookRow[] = [];
    const notes = this.freezeNotes();
    const me = this.auth.me()?.username;
    const nameOf = (id: number) => this.nameOf().get(id) ?? `#${id}`;

    for (const a of this.frozen()) {
      const note = notes.get(a.accountId);
      const why = note
        ? fill(t.frozenBy, { who: note.by === me ? t.you : note.by, date: this.i18n.day(note.at) }) + (note.reason ? ' ' + note.reason : '')
        : t.frozenPlain;
      rows.push({ key: `f${a.accountId}`, kind: 'frozen', accountId: a.accountId, name: a.name, why, tag: t.tagFrozen, glyph: GLYPH.frozen });
    }

    for (const [id, list] of byAccount(this.failedToday())) {
      const n = list.length;
      const params = { n, symbols: symbolsOf(list, t), side: sideWord(list, t, false), sides: sideWord(list, t, true), time: this.i18n.time(list[0].placedTime) };
      rows.push({
        key: `x${id}`,
        kind: 'failed',
        accountId: id,
        name: nameOf(id),
        why: fill(n === 1 ? t.failedOne : t.failed, params),
        tag: fill(t.tagFailed, { n }),
        glyph: GLYPH.failed,
      });
    }

    for (const [id, list] of byAccount(this.pending())) {
      const n = list.length;
      const limit = list.every((o) => o.orderType === 'LIMIT');
      const template = limit ? (n === 1 ? t.pendingLimitOne : t.pendingLimit) : n === 1 ? t.pendingOne : t.pending;
      rows.push({
        key: `p${id}`,
        kind: 'pending',
        accountId: id,
        name: nameOf(id),
        why: fill(template, { n, since: this.since(list[list.length - 1].placedTime) }),
        tag: fill(t.tagPending, { n }),
        glyph: GLYPH.pending,
      });
    }
    return rows;
  });

  readonly latest = computed(() => {
    const t = this.t();
    return this.orders()
      .slice(0, LATEST)
      .map((o) => ({
        id: o.orderId,
        buy: o.side === 'BUY',
        side: o.side === 'BUY' ? t.buy : t.sell,
        symbol: o.symbol,
        qty: formatQty(o.quantity),
        account: `${this.nameOf().get(o.accountId) ?? ''} #${o.accountId}`.trim(),
        accountId: o.accountId,
        when: this.i18n.stamp(o.placedTime),
        value: this.i18n.usd(o.value),
        status: t.status[o.status],
        glyph: STATUS_GLYPH[o.status],
        tone: statusTone(o.status),
      }));
  });

  readonly summary = computed(() => {
    const t = this.t();
    const n = new Set(this.look().map((l) => l.accountId)).size;
    if (this.loading() && !this.loadedAt()) return t.loadingSummary;
    if (n === 0) return t.quietSummary;
    return n === 1 ? t.summaryOne : fill(t.summary, { n });
  });

  /** Set once the first load has finished, so skeletons only show before any data. */
  readonly loaded = computed(() => this.loadedAt() !== null);

  constructor() {
    this.reload();
  }

  inspectLabel(name: string): string {
    return fill(this.t().inspectAria, { name });
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
          const notes$ = frozen.length
            ? forkJoin(
                frozen.map((a) =>
                  this.ops.statusEvents(a.accountId).pipe(
                    map((events) => [a.accountId, latestFreeze(events)] as const),
                    catchError(() => of([a.accountId, null] as const)),
                  ),
                ),
              )
            : of([] as (readonly [number, FreezeNote | null])[]);
          return notes$.pipe(map((notes) => ({ accounts, page, notes })));
        }),
      )
      .subscribe({
        next: ({ accounts, page, notes }) => {
          this.accounts.set(accounts);
          this.orders.set(page.orders);
          this.truncated.set(page.hasNext);
          const found = new Map<number, FreezeNote>();
          for (const [id, note] of notes) if (note) found.set(id, note);
          this.freezeNotes.set(found);
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

  /** "this morning", "this afternoon", "this evening", or a date for older orders. */
  private since(iso: string): string {
    const t = this.t();
    const at = new Date(iso);
    if (at.toDateString() !== new Date().toDateString()) return this.i18n.day(iso);
    const hour = at.getHours();
    return hour < 12 ? t.thisMorning : hour < 18 ? t.thisAfternoon : t.thisEvening;
  }
}

/** Orders grouped by account, newest first within each, in order of each account's newest order. */
function byAccount(orders: readonly Order[]): Map<number, Order[]> {
  const groups = new Map<number, Order[]>();
  for (const o of orders) {
    const list = groups.get(o.accountId);
    if (list) list.push(o);
    else groups.set(o.accountId, [o]);
  }
  return groups;
}

/** "TSLA", "TSLA and AAPL", "TSLA, AAPL and others". */
function symbolsOf(orders: readonly Order[], t: OpsText): string {
  const symbols = [...new Set(orders.map((o) => o.symbol))];
  if (symbols.length <= 2) return symbols.join(` ${t.and} `);
  return `${symbols.slice(0, 2).join(', ')} ${t.and} ${t.others}`;
}

/** "buy"/"buys", "sell"/"sells", or "order"/"orders" when the group mixes sides. */
function sideWord(orders: readonly Order[], t: OpsText, many: boolean): string {
  const sides = new Set(orders.map((o) => o.side));
  if (sides.size > 1) return many ? t.orderN : t.order1;
  return orders[0].side === 'BUY' ? (many ? t.buyN : t.buy1) : many ? t.sellN : t.sell1;
}

/** The newest FREEZE event, as who froze it, when, and why. */
function latestFreeze(events: readonly Record<string, unknown>[]): FreezeNote | null {
  const freezes = events
    .filter((e) => e['action'] === 'FREEZE')
    .sort((a, b) => String(b['occurredAt']).localeCompare(String(a['occurredAt'])));
  const e = freezes[0];
  if (!e) return null;
  return { reason: String(e['reason'] ?? ''), by: String(e['actorUsername'] ?? 'ops'), at: String(e['occurredAt'] ?? '') };
}
