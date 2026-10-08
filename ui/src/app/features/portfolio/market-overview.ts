import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, formatSignedPct, formatTime } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { Sparkline } from '../../shared/sparkline';
import { DayChangeStore } from './day-change.store';

const SHOWN = 5;

/** Live prices and the recorded 24-hour move, linking to Markets for the rest. */
@Component({
  selector: 'leap-market-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, Sparkline, Icon],
  template: `
    <section class="card">
      <div class="head">
        <h2 class="title">Market Overview</h2>
        <a class="btn btn-secondary btn-sm" routerLink="/markets">View All <leap-icon name="external" [size]="14" /></a>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>24H trend</th>
              <th class="r">Price</th>
              <th class="r">24H%</th>
              <th class="opt">Market</th>
              <th class="r opt">Updated</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <div class="ident">
                    <leap-instrument-logo [symbol]="row.symbol" [size]="30" />
                    <div class="ident-text">
                      <a class="sym stretch-link" [routerLink]="['/instrument', row.id]" [attr.aria-label]="'View ' + row.symbol + ', ' + row.name">{{
                        row.symbol
                      }}</a>
                      <span class="name">{{ row.name }}</span>
                    </div>
                  </div>
                </td>
                <td><leap-sparkline [points]="row.points" [width]="72" [height]="28" /></td>
                <td class="r">
                  <div class="price num">{{ row.price }}</div>
                  @if (row.delta) {
                    <div class="delta num" [class.up]="row.dir > 0" [class.down]="row.dir < 0">{{ row.delta }}</div>
                  }
                </td>
                <td class="r num pct" [class.up]="row.dir > 0" [class.down]="row.dir < 0">{{ row.pct ?? '—' }}</td>
                <td class="market opt">{{ row.market }}</td>
                <td class="r num when opt">{{ row.updated }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (rows().length === 0) {
          <p class="empty">
            @if (!store.loaded()) {
              Loading prices…
            } @else {
              No instruments in the database.
            }
          </p>
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
        padding: 20px 24px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px 16px;
        min-height: 34px;
        margin-bottom: 14px;
      }
      .title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.005em;
      }
      /* Header plus room for five rows, so the card keeps its height while prices load. */
      .table-wrap {
        position: relative;
        overflow-x: auto;
        min-height: calc(37px + 5 * 54px);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
      }
      th {
        padding: 10px 12px;
        text-align: left;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--text-3);
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      td {
        height: 54px;
        padding: 0 12px;
        white-space: nowrap;
      }
      th:first-child,
      td:first-child {
        padding-left: 0;
      }
      th:last-child,
      td:last-child {
        padding-right: 0;
      }
      .r {
        text-align: right;
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
        line-height: 1.35;
      }
      .sym {
        font-weight: 600;
        border-radius: 4px;
      }
      .name {
        font-size: 12px;
        color: var(--text-3);
        max-width: 170px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .price {
        font-weight: 600;
        line-height: 1.35;
      }
      .delta {
        font-size: 12px;
        line-height: 1.35;
      }
      .pct {
        font-weight: 500;
      }
      .market,
      .when {
        color: var(--text-3);
        font-size: 12.5px;
      }
      /* Phones: drop the secondary columns so price and change stay in view. */
      @media (max-width: 560px) {
        .card {
          padding: 16px;
        }
        .opt,
        .ident leap-instrument-logo {
          display: none;
        }
        th,
        td {
          padding-inline: 8px;
        }
        th:nth-child(4),
        .pct {
          padding-right: 0;
        }
        leap-sparkline ::ng-deep svg {
          width: 48px;
        }
        .name {
          max-width: 90px;
        }
      }
      .empty {
        position: absolute;
        inset: 37px 0 0;
        display: grid;
        place-items: center;
        margin: 0;
        font-size: 13px;
        color: var(--text-3);
      }
    `,
  ],
})
export class MarketOverview {
  protected readonly store = inject(DayChangeStore);
  readonly rows = computed(() =>
    this.store.rows().slice(0, SHOWN).map((r) => ({
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
