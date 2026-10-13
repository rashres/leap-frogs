import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, formatSignedPct } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { DayChangeStore } from './day-change.store';

const SHOWN = 3;

type Tab = 'all' | 'gainers' | 'losers';

/**
 * Instruments with Buy / Sell shortcuts. The buttons open the existing order
 * ticket on the instrument page with that side selected; no order is sent from here.
 */
@Component({
  selector: 'leap-exchange-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, Icon],
  template: `
    <section class="card">
      <div class="head">
        <h2 class="title">Exchange stock</h2>
        <a class="more" routerLink="/markets" aria-label="Open Markets" title="Open Markets">
          <leap-icon name="chevron-right" [size]="16" />
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
              <leap-instrument-logo [symbol]="row.symbol" [size]="32" />
              <a class="ident" [routerLink]="['/instrument', row.id]">
                <span class="name">{{ row.name }}</span>
                <span class="sym">{{ row.symbol }} · {{ row.market }}</span>
              </a>
              <span class="quote">
                <span class="price num">{{ row.price }}</span>
                @if (row.pct; as pct) {
                  <span class="chg num" [class.up]="!row.negative" [class.down]="row.negative">{{ row.negative ? '↓' : '↑' }} {{ pct }}</span>
                } @else {
                  <span class="chg faint">—</span>
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
            } @else if (tab() === 'all') {
              No priced instruments yet.
            } @else {
              No instruments {{ tab() === 'gainers' ? 'up' : 'down' }} over the last day.
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
        padding: 20px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 34px;
        margin-bottom: 12px;
      }
      .title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.005em;
      }
      .more {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        color: var(--text-3);
      }
      .more:hover {
        background: var(--panel-hover);
        color: var(--text);
      }
      .tabs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 6px;
      }
      .tabs button {
        height: 28px;
      }
      /* Room for three instruments whichever tab is open, so the card never jumps. */
      .list {
        display: flex;
        flex-direction: column;
        min-height: calc(3 * 96px);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        padding: 12px 0 8px;
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
        line-height: 1.35;
      }
      .ident:hover .name {
        color: var(--accent);
      }
      .name {
        font-size: 13.5px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sym {
        font-size: 12px;
        color: var(--text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .quote {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        line-height: 1.35;
      }
      .price {
        font-size: 14px;
        font-weight: 600;
      }
      .chg {
        font-size: 12.5px;
        font-weight: 500;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }
      .actions .btn {
        height: 32px;
      }
      .empty {
        margin: auto 0;
        padding: 0;
        text-align: center;
        font-size: 13px;
        color: var(--text-3);
      }
    `,
  ],
})
export class ExchangePanel {
  protected readonly store = inject(DayChangeStore);
  readonly tab = signal<Tab>('all');

  private readonly priced = computed(() => this.store.rows().filter((r) => r.price != null));
  private readonly gainers = computed(() =>
    this.priced()
      .filter((r) => (r.changePct ?? 0) > 0)
      .sort((a, b) => b.changePct! - a.changePct!),
  );
  private readonly losers = computed(() =>
    this.priced()
      .filter((r) => (r.changePct ?? 0) < 0)
      .sort((a, b) => a.changePct! - b.changePct!),
  );

  readonly tabs: readonly { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
  ];

  readonly rows = computed(() => {
    const tab = this.tab();
    const list = tab === 'gainers' ? this.gainers() : tab === 'losers' ? this.losers() : this.priced();
    return list.slice(0, SHOWN).map((r) => ({
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
