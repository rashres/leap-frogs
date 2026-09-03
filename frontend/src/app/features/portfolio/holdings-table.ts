/**
 * Holdings table.
 *
 * Every money column renders in the instrument's OWN settlement currency —
 * a US equity in USD, an LSE line in GBP, an NSE line in INR. Only the
 * right-hand "value" column is converted, and only for display. Mixing
 * currencies into one column without saying so is exactly the kind of quiet
 * misstatement the per-currency cash model exists to prevent.
 *
 * [US-12]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/data/market-data.service';
import { PortfolioService } from '../../core/data/portfolio.service';
import { policyFor } from '../../core/domain/instrument';
import { Sparkline } from '../../shared/sparkline';
import { ChangePill } from '../../shared/change-pill';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

@Component({
  selector: 'leap-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Sparkline, ChangePill, InstrumentLogo, LivePrice],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Holdings · {{ rows().length }}</h2>
        <span class="pnl num" [class.up]="!totalPnl().isNegative()" [class.down]="totalPnl().isNegative()">
          {{ totalPnl().formatSigned() }} unrealised
        </span>
      </div>

      @if (rows().length === 0) {
        <p class="empty">No holdings yet.</p>
      } @else {
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="l">Instrument</th>
                <th></th>
                <th class="r">Quantity</th>
                <th class="r">Avg cost</th>
                <th class="r">Last</th>
                <th class="r">Today</th>
                <th class="r">Market value</th>
                <th class="r">Unrealised P/L</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.instrumentId) {
                <tr>
                  <td class="l">
                    <div class="ident">
                      <leap-instrument-logo [instrumentId]="row.instrumentId" [symbol]="row.symbol" [size]="32" />
                      <div class="ident-text">
                        <!-- A real link, so the row is reachable and activatable
                             by keyboard; .stretch-link widens its hit area to
                             the whole row for mouse users. -->
                        <a
                          class="sym stretch-link"
                          [routerLink]="['/instrument', row.instrumentId]"
                          [attr.aria-label]="'View ' + row.symbol + ', ' + row.name"
                          >{{ row.symbol }}</a
                        >
                        <div class="name faint">{{ row.name }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="spark">
                    <leap-sparkline
                      [points]="row.spark"
                      [tone]="row.dayChangePercent.isNegative() ? 'down' : 'up'"
                    />
                  </td>
                  <td class="r num">{{ row.quantity.toTrimmedString() }}</td>
                  <td class="r num dim">{{ row.averageCost.format() }}</td>
                  <td class="r strong">
                    <leap-live-price [value]="row.lastPrice.amount" [currency]="row.lastPrice.currency" />
                  </td>
                  <td class="r"><leap-change-pill [percent]="row.dayChangePercent" /></td>
                  <td class="r num strong">
                    {{ row.marketValue.format() }}
                    <span class="ccy faint">{{ row.marketValue.currency }}</span>
                  </td>
                  <td class="r num" [class.up]="!row.unrealisedPnl.isNegative()" [class.down]="row.unrealisedPnl.isNegative()">
                    <div>{{ row.unrealisedPnl.formatSigned() }}</div>
                    <div class="sub">
                      {{ row.unrealisedPnlPercent.isNegative() ? '' : '+' }}{{ row.unrealisedPnlPercent.toString() }}%
                    </div>
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
      /* Positioned so the stretched row link resolves against the row. */
      tbody tr {
        position: relative;
        transition: background 0.12s ease;
      }
      tbody tr:hover {
        background: var(--panel-hover);
      }
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
      .spark {
        width: 80px;
        padding-right: 0;
      }
      .pnl {
        font-size: 12.5px;
        font-weight: 650;
      }
    `,
  ],
})
export class HoldingsTable {
  private readonly market = inject(MarketDataService);
  private readonly portfolio = inject(PortfolioService);

  readonly totalPnl = computed(() => this.portfolio.totalUnrealisedPnl());

  readonly rows = computed(() =>
    this.portfolio.holdings().map((holding) => ({
      ...holding,
      spark: this.market.sparkline(holding.instrumentId),
      quantityScale: policyFor(this.market.requireInstrument(holding.instrumentId).classCode).quantityScale,
    })),
  );
}
