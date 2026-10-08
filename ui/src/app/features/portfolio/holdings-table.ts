import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marketFor } from '../../core/markets/sessions';
import { PortfolioStore, type Position } from '../../core/state/portfolio.store';
import { formatQty, formatSignedPct, formatPrice, formatSignedUsd, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

type SortKey = 'instrument' | 'value' | 'return';
type SortDir = 'asc' | 'desc';

/** Direction used the first time a column is picked: A→Z for names, largest first for numbers. */
const FIRST_DIR: Record<SortKey, SortDir> = { instrument: 'asc', value: 'desc', return: 'desc' };

/** Positions for the active account: sortable, with per-position detail rows. */
@Component({
  selector: 'leap-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice, Icon],
  template: `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Holdings <span class="count">{{ rows().length }}</span></h2>
          <p class="panel-sub">
            Valued at the latest price
            @if (rows().length > 0) {
              · <span class="num">{{ invested() }}</span> invested
            }
          </p>
        </div>
      </div>

      @if (portfolio.holdings.error(); as e) {
        <div class="pad"><p class="state-error">{{ e.message }}</p></div>
      } @else if (portfolio.holdings.initialLoading()) {
        <div class="pad loading" aria-hidden="true">
          @for (n of [1, 2, 3]; track n) {
            <div class="sk-row">
              <span class="skeleton" style="width: 28px; height: 28px; border-radius: 50%"></span>
              <span class="skeleton" style="width: 30%"></span>
              <span class="skeleton" style="width: 18%; margin-left: auto"></span>
            </div>
          }
        </div>
        <p class="sr-only" role="status">Loading holdings…</p>
      } @else if (rows().length === 0) {
        <p class="empty"><span class="empty-title">No holdings yet</span>Buy an instrument from Markets and it will appear here.</p>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th [attr.aria-sort]="ariaSort('instrument')">
                  <button type="button" class="sort" (click)="sortBy('instrument')">
                    Instrument
                    <span class="arrow" [class.on]="sort().key === 'instrument'" aria-hidden="true">{{ arrowFor('instrument') }}</span>
                  </button>
                </th>
                <th class="r qty-col">Quantity</th>
                <th class="r" [attr.aria-sort]="ariaSort('value')">
                  <button type="button" class="sort" (click)="sortBy('value')">
                    <span class="arrow" [class.on]="sort().key === 'value'" aria-hidden="true">{{ arrowFor('value') }}</span>
                    Market value
                  </button>
                </th>
                <th class="r" [attr.aria-sort]="ariaSort('return')">
                  <button type="button" class="sort" (click)="sortBy('return')">
                    <span class="arrow" [class.on]="sort().key === 'return'" aria-hidden="true">{{ arrowFor('return') }}</span>
                    <span class="ret-label"><span class="wide-only">Unrealized </span>return</span>
                  </button>
                </th>
                <th class="chev-col"><span class="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.instrumentId) {
                @let open = expanded() === row.instrumentId;
                <tr class="row" [class.open]="open" (click)="toggle(row.instrumentId, $event)">
                  <td>
                    <div class="ident">
                      <leap-instrument-logo [symbol]="row.symbol" [size]="28" />
                      <div class="ident-text">
                        <a class="sym" [routerLink]="['/instrument', row.instrumentId]" [attr.aria-label]="'View ' + row.symbol + ', ' + row.name">{{ row.symbol }}</a>
                        <div class="name">{{ row.name }}</div>
                        <div class="qty-inline num">Qty {{ row.qty }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="r num qty-col">{{ row.qty }}</td>
                  <td class="r num strong">{{ row.value }}</td>
                  <td class="r num">
                    @if (row.unrealisedPnl != null) {
                      <span class="ret" [class.up]="row.unrealisedPnl >= 0" [class.down]="row.unrealisedPnl < 0">
                        <span class="strong">{{ row.pnl }}</span>
                        @if (row.unrealisedPnlPercent != null) {
                          <span class="pct">{{ row.pct }}</span>
                        }
                      </span>
                    } @else {
                      <span class="faint">—</span>
                    }
                  </td>
                  <td class="chev-col">
                    <button
                      type="button"
                      class="chev"
                      [attr.aria-expanded]="open"
                      [attr.aria-controls]="'holding-' + row.instrumentId"
                      [attr.aria-label]="(open ? 'Hide' : 'Show') + ' details for ' + row.symbol"
                      (click)="toggle(row.instrumentId); $event.stopPropagation()"
                    >
                      <leap-icon name="chevron-down" [size]="16" />
                    </button>
                  </td>
                </tr>
                @if (open) {
                  <tr class="detail" [id]="'holding-' + row.instrumentId">
                    <td colspan="5">
                      <dl class="facts">
                        <div>
                          <dt>Avg cost</dt>
                          <dd class="num">{{ row.avg }}</dd>
                        </div>
                        <div>
                          <dt>Last price</dt>
                          <dd>
                            @if (row.lastPrice != null) {
                              <leap-live-price [value]="row.lastPrice" />
                            } @else {
                              <span class="faint">No price yet</span>
                            }
                          </dd>
                        </div>
                        <div>
                          <dt>Book cost</dt>
                          <dd class="num">{{ row.book }}</dd>
                        </div>
                        <div>
                          <dt>Portfolio weight</dt>
                          <dd class="num">{{ row.weight }}</dd>
                        </div>
                        <div>
                          <dt>Market</dt>
                          <dd>{{ row.market }}</dd>
                        </div>
                      </dl>
                      <div class="trade">
                        <a class="btn btn-secondary btn-sm" [routerLink]="['/instrument', row.instrumentId]" [queryParams]="{ side: 'SELL' }">Sell</a>
                        <a class="btn btn-primary btn-sm" [routerLink]="['/instrument', row.instrumentId]" [queryParams]="{ side: 'BUY' }">Buy</a>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .count {
        display: inline-grid;
        place-items: center;
        min-width: 22px;
        height: 20px;
        margin-left: 6px;
        padding: 0 7px;
        border-radius: 999px;
        background: var(--panel-3);
        color: var(--text-2);
        font-size: 11.5px;
        font-weight: 600;
        vertical-align: 2px;
      }
      .pad {
        padding: 16px 20px;
      }
      .sk-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 8px 0;
      }
      .data-table {
        font-size: 13.5px;
      }
      .data-table th {
        padding: 9px 20px;
      }
      .data-table td {
        padding: 10px 20px;
      }
      .sort {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .sort:hover {
        color: var(--text);
      }
      .arrow {
        font-size: 11px;
        opacity: 0;
        transition: opacity 0.12s ease;
      }
      .sort:hover .arrow {
        opacity: 0.5;
      }
      .arrow.on,
      .sort:hover .arrow.on {
        opacity: 1;
        color: var(--accent);
      }
      .row {
        cursor: pointer;
      }
      .row.open {
        background: var(--panel-hover);
      }
      .row.open td {
        border-bottom-color: transparent;
      }
      .ident {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ident-text {
        min-width: 0;
        line-height: 1.3;
      }
      .sym {
        font-weight: 600;
        font-size: 13.5px;
        border-radius: 4px;
      }
      .sym:hover {
        color: var(--accent);
      }
      .name {
        font-size: 12px;
        color: var(--text-3);
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .strong {
        font-weight: 600;
      }
      .ret {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
      }
      .pct {
        min-width: 58px;
        font-size: 12px;
        font-weight: 600;
        text-align: right;
      }
      .chev-col {
        width: 44px;
        padding-left: 0 !important;
        padding-right: 12px !important;
        text-align: right;
      }
      .chev {
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: none;
        color: var(--text-3);
        cursor: pointer;
        transition:
          transform 0.15s ease,
          background-color 0.12s ease;
      }
      .chev:hover {
        background: var(--panel-3);
        color: var(--text);
      }
      .chev[aria-expanded='true'] {
        transform: rotate(180deg);
      }
      .detail,
      .detail:hover {
        background: var(--panel-hover);
      }
      .detail td {
        padding: 2px 20px 14px 58px;
        white-space: normal;
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 32px;
        margin: 0;
      }
      .facts dt {
        font-size: 11.5px;
        color: var(--text-3);
      }
      .facts dd {
        margin: 2px 0 0;
        font-size: 13px;
        font-weight: 600;
      }
      .trade {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .trade .btn {
        min-width: 72px;
      }
      .qty-inline {
        display: none;
        font-size: 12px;
        color: var(--text-3);
      }
      /* Phones: quantity moves under the name so value and return stay on screen. */
      @media (max-width: 560px) {
        .data-table th,
        .data-table td {
          padding-left: 12px;
          padding-right: 12px;
        }
        .qty-col,
        .wide-only,
        .ident leap-instrument-logo {
          display: none;
        }
        .ret-label {
          text-transform: capitalize;
        }
        .qty-inline {
          display: block;
        }
        .name {
          max-width: 100px;
        }
        .chev-col {
          width: 32px;
          padding-right: 4px !important;
        }
        .ret {
          flex-direction: column;
          align-items: flex-end;
          gap: 0;
        }
        .detail td {
          padding-left: 14px;
        }
      }
    `,
  ],
  host: { '(document:keydown.escape)': 'expanded.set(null)' },
})
export class HoldingsTable {
  protected readonly portfolio = inject(PortfolioStore);

  readonly sort = signal<{ key: SortKey; dir: SortDir }>({ key: 'value', dir: 'desc' });
  readonly expanded = signal<number | null>(null);

  readonly invested = computed(() => formatUsd(this.portfolio.marketValue()));

  readonly rows = computed(() => {
    const { key, dir } = this.sort();
    const total = this.portfolio.totalValue();
    return [...this.portfolio.positions()]
      .sort((a, b) => compare(a, b, key, dir))
      .map((p) => ({
        ...p,
        qty: formatQty(p.quantity),
        avg: formatPrice(p.averageCost),
        book: formatUsd(p.bookCost),
        value: formatUsd(p.marketValue),
        pnl: formatSignedUsd(p.unrealisedPnl),
        pct: formatSignedPct(p.unrealisedPnlPercent),
        weight: p.marketValue != null && total ? `${((p.marketValue / total) * 100).toFixed(1)}%` : '—',
        market: marketFor(p.exchange)?.label ?? p.exchange,
      }));
  });

  sortBy(key: SortKey): void {
    const current = this.sort();
    this.sort.set(current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: FIRST_DIR[key] });
  }

  arrowFor(key: SortKey): string {
    const s = this.sort();
    return s.key === key && s.dir === 'asc' ? '↑' : '↓';
  }

  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return s.key !== key ? 'none' : s.dir === 'asc' ? 'ascending' : 'descending';
  }

  toggle(id: number, event?: MouseEvent): void {
    if (event && (event.target as HTMLElement).closest('a, button')) return;
    this.expanded.update((current) => (current === id ? null : id));
  }
}

/** Sorts by the chosen column; positions without a value always sink to the bottom. */
function compare(a: Position, b: Position, key: SortKey, dir: SortDir): number {
  if (key === 'instrument') {
    const r = a.symbol.localeCompare(b.symbol);
    return dir === 'asc' ? r : -r;
  }
  const av = key === 'value' ? a.marketValue : a.unrealisedPnlPercent;
  const bv = key === 'value' ? b.marketValue : b.unrealisedPnlPercent;
  if (av == null && bv == null) return a.symbol.localeCompare(b.symbol);
  if (av == null) return 1;
  if (bv == null) return -1;
  return dir === 'asc' ? av - bv : bv - av;
}
