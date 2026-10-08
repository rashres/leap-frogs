import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, formatSignedPct, formatTime } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { Sparkline } from '../../shared/sparkline';
import { DayChangeStore } from './day-change.store';

const SHOWN = 8;

/** Every instrument's live price and recorded 24-hour move, linking to Markets for the rest. */
@Component({
  selector: 'leap-market-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, Sparkline, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <div>
          <h2 class="panel-title">Market overview</h2>
          <p class="panel-sub">Live prices and the move across the last recorded day</p>
        </div>
        <a class="btn btn-secondary btn-sm" routerLink="/markets">View all <leap-icon name="external" [size]="14" /></a>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Market</th>
              <th>24H trend</th>
              <th class="r">Price</th>
              <th class="r">24H change</th>
              <th class="r">Updated</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <div class="ident">
                    <leap-instrument-logo [symbol]="row.symbol" [size]="32" />
                    <div class="ident-text">
                      <a class="sym stretch-link" [routerLink]="['/instrument', row.id]" [attr.aria-label]="'View ' + row.symbol + ', ' + row.name">{{
                        row.symbol
                      }}</a>
                      <span class="name">{{ row.name }}</span>
                    </div>
                  </div>
                </td>
                <td><span class="tag">{{ row.market }}</span></td>
                <td><leap-sparkline [points]="row.points" /></td>
                <td class="r num strong">{{ row.price }}</td>
                <td class="r num" [class.up]="row.dir > 0" [class.down]="row.dir < 0">
                  @if (row.pct; as pct) {
                    <div class="strong">{{ pct }}</div>
                    <div class="sub">{{ row.delta }}</div>
                  } @else {
                    <span class="faint">—</span>
                  }
                </td>
                <td class="r num faint">{{ row.updated }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty">{{ store.loaded() ? 'No instruments in the database.' : 'Loading prices…' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (hidden() > 0) {
        <a class="foot" routerLink="/markets">{{ hidden() }} more on Markets <leap-icon name="chevron-right" [size]="14" /></a>
      }
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
        gap: 12px;
        padding: 14px 20px 12px;
      }
      .data-table th,
      .data-table td {
        padding-inline: 16px;
      }
      .data-table td {
        padding-block: 9px;
      }
      tbody tr {
        position: relative;
      }
      tbody tr:hover .sym {
        color: var(--accent);
      }
      .ident {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ident-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .sym {
        font-weight: 600;
        border-radius: 4px;
      }
      .name {
        font-size: 12px;
        color: var(--text-3);
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tag {
        text-transform: none;
        letter-spacing: 0;
        font-weight: 500;
      }
      .strong {
        font-weight: 600;
      }
      .sub {
        font-size: 12px;
        opacity: 0.85;
      }
      .empty {
        text-align: center;
        color: var(--text-3);
        padding: 28px;
      }
      .foot {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin-top: auto;
        padding: 11px;
        border-top: 1px solid var(--border-soft);
        font-size: 13px;
        font-weight: 600;
        color: var(--accent);
      }
      .foot:hover {
        background: var(--panel-hover);
      }
    `,
  ],
})
export class MarketOverview {
  protected readonly store = inject(DayChangeStore);

  readonly hidden = computed(() => Math.max(0, this.store.rows().length - SHOWN));

  readonly rows = computed(() =>
    this.store
      .rows()
      .slice(0, SHOWN)
      .map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        market: r.market,
        points: r.points,
        price: formatPrice(r.price),
        pct: r.changePct != null ? formatSignedPct(r.changePct) : null,
        delta: r.change != null ? `${r.change < 0 ? '−' : '+'}${formatPrice(Math.abs(r.change), r.price)}` : '',
        dir: Math.sign(r.change ?? 0),
        updated: r.updatedAt ? formatTime(r.updatedAt) : '—',
      })),
  );
}
