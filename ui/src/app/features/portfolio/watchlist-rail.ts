import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marketFor } from '../../core/markets/sessions';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { MarketStore } from '../../core/state/market.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';
import { Icon } from '../../shared/icon';
import { formatSignedPct } from '../../shared/format';
import { DayChangeStore } from './day-change.store';

const RESULT_LIMIT = 8;
const UNDO_MS = 5000;

/** Starred instruments with their latest price, plus search-to-add and remove with undo. */
@Component({
  selector: 'leap-watchlist-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <h2 class="panel-title">My watchlist</h2>
        <span class="count">{{ rows().length }}</span>
      </div>

      <div class="search" [class.active]="query()">
        <leap-icon name="search" [size]="16" />
        <input
          type="search"
          placeholder="Search to add instruments"
          aria-label="Search instruments to add to your watchlist"
          autocomplete="off"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown.escape)="clearSearch($event)"
          (keydown.enter)="addFirst()"
        />
        @if (query()) {
          <button type="button" class="clear" aria-label="Clear search" (click)="query.set('')">
            <leap-icon name="x" [size]="14" />
          </button>
        }
      </div>

      @if (query()) {
        <ul class="list results" aria-label="Search results">
          @for (r of results(); track r.id) {
            <li>
              <div class="result">
                <leap-instrument-logo [symbol]="r.symbol" [size]="30" />
                <div class="left">
                  <div class="sym">{{ r.symbol }}</div>
                  <div class="name">{{ r.name }} · {{ r.market }}</div>
                </div>
                @if (r.watched) {
                  <button
                    type="button"
                    class="add added"
                    [attr.aria-label]="'Remove ' + r.symbol + ' from watchlist'"
                    title="In watchlist — click to remove"
                    (click)="remove(r.id, r.symbol)"
                  >
                    <leap-icon name="check" [size]="15" [stroke]="2.2" />
                  </button>
                } @else {
                  <button
                    type="button"
                    class="add"
                    [attr.aria-label]="'Add ' + r.symbol + ' to watchlist'"
                    title="Add to watchlist"
                    (click)="watchlist.add(r.id)"
                  >
                    <leap-icon name="plus" [size]="15" [stroke]="2.2" />
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="no-match">No instruments match “{{ query() }}”.</li>
          }
        </ul>
      } @else if (rows().length === 0) {
        <div class="empty">
          <leap-icon name="star" [size]="20" />
          <p>Your watchlist is empty. Search above or star instruments on Markets.</p>
        </div>
      } @else {
        <ul class="list">
          @for (row of rows(); track row.id) {
            <li class="row">
              <a [routerLink]="['/instrument', row.id]">
                <leap-instrument-logo [symbol]="row.symbol" [size]="34" />
                <div class="left">
                  <div class="sym">
                    {{ row.symbol }}
                    @if (!row.open) {
                      <i class="closed" title="Market closed"></i>
                    }
                  </div>
                  <div class="name">{{ row.name }}</div>
                </div>
                <div class="right">
                  @if (row.price != null) {
                    <leap-live-price class="price" [value]="row.price" />
                  } @else {
                    <span class="price faint">—</span>
                  }
                  @if (row.pct; as pct) {
                    <div class="chg num" [class.up]="!row.negative" [class.down]="row.negative">
                      <leap-icon [name]="row.negative ? 'trending-down' : 'trending-up'" [size]="12" />{{ pct }}
                    </div>
                  } @else {
                    <div class="chg faint">{{ row.exchange }}</div>
                  }
                </div>
              </a>
              <button
                type="button"
                class="remove"
                [attr.aria-label]="'Remove ' + row.symbol + ' from watchlist'"
                title="Remove from watchlist"
                (click)="remove(row.id, row.symbol)"
              >
                <leap-icon name="trash" [size]="15" />
              </button>
            </li>
          }
        </ul>
      }

      <div class="foot">
        @if (undo(); as u) {
          <div class="undo" role="status">
            <span>Removed <b>{{ u.symbol }}</b></span>
            <button type="button" class="undo-btn" (click)="restore()">Undo</button>
          </div>
        } @else {
          <a class="btn btn-secondary btn-sm" routerLink="/markets">Browse all on Markets</a>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 10px;
      }
      .count {
        display: inline-grid;
        place-items: center;
        min-width: 24px;
        height: 22px;
        padding: 0 7px;
        border-radius: 999px;
        background: var(--panel-3);
        color: var(--text-2);
        font-size: 12px;
        font-weight: 600;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 16px 8px;
        padding: 0 10px;
        height: 38px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--panel-2);
        color: var(--text-3);
        transition:
          border-color 0.12s ease,
          box-shadow 0.12s ease,
          background-color 0.12s ease;
      }
      .search:focus-within {
        border-color: var(--accent);
        background: var(--panel);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
      }
      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 13px;
      }
      .search input::-webkit-search-cancel-button {
        display: none;
      }
      .clear {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border: 0;
        border-radius: 50%;
        background: var(--panel-3);
        color: var(--text-2);
        cursor: pointer;
      }
      /* Basis 0 so the chart beside it sets the row height; the list scrolls. */
      .list {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        list-style: none;
        margin: 0;
        padding: 0 8px;
      }
      .row {
        position: relative;
        border-radius: var(--radius);
        transition: background-color 0.12s ease;
      }
      .row:hover,
      .row:focus-within {
        background: var(--panel-hover);
      }
      .row a,
      .result {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border-radius: var(--radius);
      }
      .result {
        padding: 7px 8px 7px 12px;
      }
      .sym {
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .closed {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-3);
      }
      .name {
        font-size: 12px;
        color: var(--text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        transition: opacity 0.12s ease;
      }
      .price {
        font-size: 14px;
        font-weight: 600;
      }
      .chg {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 12px;
        font-weight: 600;
      }
      /* Remove button fades in over the price on hover / keyboard focus. */
      .remove {
        position: absolute;
        top: 50%;
        right: 10px;
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        color: var(--text-3);
        cursor: pointer;
        opacity: 0;
        transform: translateY(-50%) scale(0.9);
        transition:
          opacity 0.12s ease,
          transform 0.12s ease,
          color 0.12s ease,
          border-color 0.12s ease,
          background-color 0.12s ease;
      }
      .row:hover .remove,
      .row:focus-within .remove {
        opacity: 1;
        transform: translateY(-50%) scale(1);
      }
      .row:hover .right,
      .row:focus-within .right {
        opacity: 0;
      }
      .remove:hover,
      .remove:focus-visible {
        color: var(--sell);
        border-color: color-mix(in srgb, var(--sell) 35%, transparent);
        background: color-mix(in srgb, var(--sell) 8%, var(--panel));
      }
      /* Touch screens have no hover: keep the button visible in its own column. */
      @media (hover: none) {
        .row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
        }
        .remove {
          position: static;
          opacity: 1;
          transform: none;
          margin-right: 6px;
        }
        .row:focus-within .right {
          opacity: 1;
        }
      }
      .add {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        color: var(--accent);
        cursor: pointer;
        transition:
          background-color 0.12s ease,
          color 0.12s ease,
          border-color 0.12s ease;
      }
      .add:hover {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      .add.added {
        background: color-mix(in srgb, var(--accent) 12%, var(--panel));
        border-color: transparent;
      }
      .add.added:hover {
        background: color-mix(in srgb, var(--sell) 10%, var(--panel));
        color: var(--sell);
      }
      .no-match {
        padding: 24px 12px;
        text-align: center;
        font-size: 13px;
        color: var(--text-3);
      }
      .empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px;
        color: var(--warn);
        text-align: center;
      }
      .empty p {
        margin: 0;
        max-width: 28ch;
        font-size: 13px;
        color: var(--text-3);
      }
      .foot {
        padding: 10px 16px 16px;
      }
      .foot .btn {
        width: 100%;
      }
      .undo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 32px;
        padding: 0 6px 0 12px;
        border-radius: var(--radius);
        background: var(--text);
        color: var(--panel);
        font-size: 13px;
        animation: undo-in 0.16s ease;
      }
      .undo-btn {
        border: 0;
        border-radius: 6px;
        padding: 4px 10px;
        background: transparent;
        color: color-mix(in srgb, var(--accent) 55%, #fff);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .undo-btn:hover {
        background: color-mix(in srgb, var(--panel) 12%, transparent);
      }
      @keyframes undo-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
      }
      @media (max-width: 1100px) {
        .list {
          flex: none;
          max-height: 360px;
        }
      }
    `,
  ],
})
export class WatchlistRail {
  protected readonly watchlist = inject(WatchlistService);
  private readonly market = inject(MarketStore);
  private readonly day = inject(DayChangeStore, { optional: true });
  private readonly account = inject(ActiveAccountService);

  readonly query = signal('');
  readonly undo = signal<{ id: number; symbol: string; index: number } | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.undoTimer));
    // An undo belongs to the account it was removed from.
    effect(() => {
      this.account.activeId();
      untracked(() => {
        clearTimeout(this.undoTimer);
        this.undo.set(null);
      });
    });
  }

  readonly rows = computed(() => {
    const now = this.market.now();
    return this.watchlist.instruments().map((i) => ({
      id: i.instrumentId,
      symbol: i.symbol,
      name: i.name,
      exchange: i.exchange,
      price: i.lastPrice ?? null,
      open: marketFor(i.exchange)?.isOpen(now) ?? true,
      ...this.change(i.instrumentId),
    }));
  });

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const watched = new Set(this.watchlist.instruments().map((i) => i.instrumentId));
    return this.market
      .instruments()
      .filter((i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      .sort((a, b) => rank(a.symbol, q) - rank(b.symbol, q) || a.symbol.localeCompare(b.symbol))
      .slice(0, RESULT_LIMIT)
      .map((i) => ({
        id: i.instrumentId,
        symbol: i.symbol,
        name: i.name,
        market: marketFor(i.exchange)?.shortLabel ?? i.exchange,
        watched: watched.has(i.instrumentId),
      }));
  });

  remove(id: number, symbol: string): void {
    const index = this.watchlist.remove(id);
    if (index < 0) return;
    clearTimeout(this.undoTimer);
    this.undo.set({ id, symbol, index });
    this.undoTimer = setTimeout(() => this.undo.set(null), UNDO_MS);
  }

  restore(): void {
    const u = this.undo();
    if (!u) return;
    this.watchlist.add(u.id, u.index);
    clearTimeout(this.undoTimer);
    this.undo.set(null);
  }

  addFirst(): void {
    const first = this.results().find((r) => !r.watched);
    if (first) this.watchlist.add(first.id);
  }

  clearSearch(event: Event): void {
    if (!this.query()) return;
    event.stopPropagation();
    this.query.set('');
  }

  private change(id: number): { pct: string | null; negative: boolean } {
    const row = this.day?.byId().get(id);
    return { pct: row?.changePct != null ? formatSignedPct(row.changePct) : null, negative: (row?.change ?? 0) < 0 };
  }
}

/** Exact symbol first, then symbols starting with the query, then other matches. */
function rank(symbol: string, q: string): number {
  const s = symbol.toLowerCase();
  return s === q ? 0 : s.startsWith(q) ? 1 : 2;
}
