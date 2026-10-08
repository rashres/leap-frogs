import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, formatSignedPct } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { DayChangeStore } from './day-change.store';

type Tab = 'all' | 'gainers' | 'losers';

/**
 * Compact instrument list with Buy / Sell shortcuts. The buttons open the
 * existing order ticket on the instrument page with that side selected; no
 * order is sent from here.
 */
@Component({
  selector: 'leap-exchange-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <h2 class="panel-title">Exchange stock</h2>
        <a class="icon-btn more" routerLink="/markets" aria-label="Open Markets" title="Open Markets">
          <leap-icon name="chevron-right" [size]="18" />
        </a>
      </div>
      <div class="segmented tabs" role="group" aria-label="Filter instruments">
        @for (t of tabs; track t.key) {
          <button type="button" [class.on]="tab() === t.key" [attr.aria-pressed]="tab() === t.key" (click)="tab.set(t.key)">
            {{ t.label }}
          </button>
        }
      </div>

      <ul class="list">
        @for (row of rows(); track row.id) {
          <li>
            <div class="line">
              <leap-instrument-logo [symbol]="row.symbol" [size]="36" />
              <a class="ident" [routerLink]="['/instrument', row.id]">
                <span class="name">{{ row.name }}</span>
                <span class="sym">{{ row.symbol }} · {{ row.market }}</span>
              </a>
              <span class="quote">
                <span class="price num">{{ row.price }}</span>
                @if (row.pct; as pct) {
                  <span class="chg num" [class.up]="!row.negative" [class.down]="row.negative">
                    <leap-icon [name]="row.negative ? 'trending-down' : 'trending-up'" [size]="13" />{{ pct }}
                  </span>
                }
              </span>
            </div>
            <div class="actions">
              <a class="btn btn-secondary btn-sm" [routerLink]="['/instrument', row.id]" [queryParams]="{ side: 'SELL' }">Sell</a>
              <a class="btn btn-primary btn-sm" [routerLink]="['/instrument', row.id]" [queryParams]="{ side: 'BUY' }">Buy</a>
            </div>
          </li>
        } @empty {
          <li class="empty">
            @if (!store.loaded()) {
              Loading prices…
            } @else {
              {{ tab() === 'all' ? 'No priced instruments yet.' : 'No instruments ' + (tab() === 'gainers' ? 'up' : 'down') + ' over the last day.' }}
            }
          </li>
        }
      </ul>
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
        padding: 14px 12px 10px 20px;
      }
      .more {
        width: 32px;
        height: 32px;
      }
      .tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin: 0 20px 6px;
      }
      /* Basis 0 so the neighbouring overview sets the row height; the list scrolls. */
      .list {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        list-style: none;
        margin: 0;
        padding: 0 20px 8px;
      }
      li {
        padding: 12px 0;
      }
      li + li {
        border-top: 1px solid var(--border-soft);
      }
      .line {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
      }
      .ident {
        display: flex;
        flex-direction: column;
        min-width: 0;
        border-radius: 4px;
      }
      .ident:hover .name {
        color: var(--accent);
      }
      .name {
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sym {
        font-size: 12px;
        color: var(--text-3);
      }
      .quote {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
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
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }
      .actions .btn {
        height: 32px;
      }
      .empty {
        padding: 28px 0;
        text-align: center;
        font-size: 13px;
        color: var(--text-3);
      }
      @media (max-width: 1100px) {
        .list {
          flex: none;
          max-height: 420px;
        }
      }
    `,
  ],
})
export class ExchangePanel {
  protected readonly store = inject(DayChangeStore);

  readonly tabs: readonly { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
  ];
  readonly tab = signal<Tab>('all');

  readonly rows = computed(() => {
    const priced = this.store.rows().filter((r) => r.price != null);
    const tab = this.tab();
    const chosen =
      tab === 'gainers'
        ? priced.filter((r) => (r.changePct ?? 0) > 0).sort((a, b) => b.changePct! - a.changePct!)
        : tab === 'losers'
          ? priced.filter((r) => (r.changePct ?? 0) < 0).sort((a, b) => a.changePct! - b.changePct!)
          : priced;
    return chosen.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      market: r.market,
      price: formatPrice(r.price),
      pct: r.changePct != null ? formatSignedPct(r.changePct) : null,
      negative: (r.change ?? 0) < 0,
    }));
  });
}
