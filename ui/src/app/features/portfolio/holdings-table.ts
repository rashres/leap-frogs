import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatSignedPct, formatSignedUsd, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

/** Holdings table, adapted from the team's Angular app (fe/21-page-mascots). */
@Component({
  selector: 'leap-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Holdings · {{ rows().length }}</h2>
        @if (portfolio.hasPnl()) {
          <span class="pnl num" [class.up]="portfolio.totalUnrealisedPnl() >= 0" [class.down]="portfolio.totalUnrealisedPnl() < 0">
            {{ totalPnl() }} unrealised
          </span>
        }
      </div>

      @if (portfolio.holdings.error(); as e) {
        <p class="empty">{{ e.message }}</p>
      } @else if (portfolio.holdings.initialLoading()) {
        <p class="empty">Loading holdings…</p>
      } @else if (rows().length === 0) {
        <p class="empty">No holdings yet.</p>
      } @else {
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="l">Instrument</th>
                <th class="r">Quantity</th>
                <th class="r">Avg cost</th>
                <th class="r">Last</th>
                <th class="r">Market value</th>
                <th class="r">Unrealised P/L</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.instrumentId) {
                <tr>
                  <td class="l">
                    <div class="ident">
                      <leap-instrument-logo [symbol]="row.symbol" [size]="32" />
                      <div class="ident-text">
                        <a class="sym stretch-link" [routerLink]="['/instrument', row.instrumentId]" [attr.aria-label]="'View ' + row.symbol + ', ' + row.name">{{
                          row.symbol
                        }}</a>
                        <div class="name faint">{{ row.name }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="r num">{{ row.qty }}</td>
                  <td class="r num dim">{{ row.avg }}</td>
                  <td class="r strong">
                    @if (row.lastPrice != null) {
                      <leap-live-price [value]="row.lastPrice" />
                    } @else {
                      <span class="faint">—</span>
                    }
                  </td>
                  <td class="r num strong">
                    {{ row.value }}
                    @if (row.marketValue != null) {
                      <span class="ccy faint">USD</span>
                    }
                  </td>
                  <td class="r num" [class.up]="(row.unrealisedPnl ?? 0) > 0" [class.down]="(row.unrealisedPnl ?? 0) < 0">
                    <div>{{ row.pnl }}</div>
                    @if (row.unrealisedPnlPercent != null) {
                      <div class="sub">{{ row.pct }}</div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th {
        padding: 9px 14px;
        font-size: 10.5px;
        font-weight: 650;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--text-3);
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      td {
        padding: 9px 14px;
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
        vertical-align: middle;
      }
      tbody tr {
        position: relative;
        transition: background 0.12s ease;
      }
      tbody tr:hover,
      tbody tr:focus-within {
        background: var(--panel-hover);
      }
      tbody tr:last-child td {
        border-bottom: none;
      }
      .l {
        text-align: left;
      }
      .r {
        text-align: right;
      }
      .ident {
        display: flex;
        align-items: center;
        gap: 11px;
      }
      .ident-text {
        min-width: 0;
      }
      .sym {
        display: inline-block;
        font-weight: 700;
        font-size: 13.5px;
      }
      .name {
        font-size: 11.5px;
        margin-top: 1px;
        max-width: 175px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .strong {
        font-weight: 650;
      }
      .sub {
        font-size: 11px;
        opacity: 0.78;
      }
      .ccy {
        font-size: 10px;
        margin-left: 3px;
      }
      .pnl {
        font-size: 12.5px;
        font-weight: 650;
      }
    `,
  ],
})
export class HoldingsTable {
  protected readonly portfolio = inject(PortfolioStore);

  readonly totalPnl = computed(() => formatSignedUsd(this.portfolio.totalUnrealisedPnl()));

  readonly rows = computed(() =>
    this.portfolio.positions().map((p) => ({
      ...p,
      qty: formatQty(p.quantity),
      avg: formatUsd(p.averageCost),
      value: formatUsd(p.marketValue),
      pnl: formatSignedUsd(p.unrealisedPnl),
      pct: formatSignedPct(p.unrealisedPnlPercent),
    })),
  );
}
