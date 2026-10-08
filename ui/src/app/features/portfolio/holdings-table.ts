import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatQty, formatSignedPct, formatPrice, formatSignedUsd, formatUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

/** Holdings table, adapted from the team's Angular app (fe/21-page-mascots). */
@Component({
  selector: 'leap-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice],
  template: `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Holdings <span class="count">{{ rows().length }}</span></h2>
          <p class="panel-sub">Positions valued at the latest price</p>
        </div>
        @if (portfolio.hasPnl()) {
          <span
            class="pill num"
            [class.pill-up]="portfolio.totalUnrealisedPnl() >= 0"
            [class.pill-down]="portfolio.totalUnrealisedPnl() < 0"
          >
            {{ totalPnl() }} unrealised
          </span>
        }
      </div>

      @if (portfolio.holdings.error(); as e) {
        <div class="pad"><p class="state-error">{{ e.message }}</p></div>
      } @else if (portfolio.holdings.initialLoading()) {
        <div class="pad loading" aria-hidden="true">
          @for (n of [1, 2, 3]; track n) {
            <div class="sk-row">
              <span class="skeleton" style="width: 36px; height: 36px; border-radius: 50%"></span>
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
                <th>Instrument</th>
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
                  <td>
                    <div class="ident">
                      <leap-instrument-logo [symbol]="row.symbol" [size]="36" />
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
                    <div class="strong">{{ row.pnl }}</div>
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
    </section>
  `,
  styles: [
    `
      .count {
        display: inline-grid;
        place-items: center;
        min-width: 24px;
        height: 22px;
        margin-left: 6px;
        padding: 0 7px;
        border-radius: 999px;
        background: var(--panel-3);
        color: var(--text-2);
        font-size: 12px;
        font-weight: 600;
        vertical-align: 2px;
      }
      .pad {
        padding: 18px 22px;
      }
      .sk-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 0;
      }
      .data-table {
        font-size: 14px;
      }
      tbody tr {
        position: relative;
      }
      tbody tr:focus-within {
        background: var(--panel-hover);
      }
      .ident {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .ident-text {
        min-width: 0;
      }
      .sym {
        display: inline-block;
        font-weight: 600;
        font-size: 14.5px;
        border-radius: 4px;
      }
      tr:hover .sym {
        color: var(--accent);
      }
      .name {
        font-size: 12.5px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .strong {
        font-weight: 600;
      }
      .sub {
        font-size: 12px;
        opacity: 0.85;
      }
      .ccy {
        font-size: 11px;
        margin-left: 3px;
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
      avg: formatPrice(p.averageCost),
      value: formatUsd(p.marketValue),
      pnl: formatSignedUsd(p.unrealisedPnl),
      pct: formatSignedPct(p.unrealisedPnlPercent),
    })),
  );
}
