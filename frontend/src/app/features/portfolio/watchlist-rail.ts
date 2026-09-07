/**
 * Watchlist rail.
 *
 * US-26 (watchlists and price alerts) is a P2 story. The watchlist half is
 * built; price alerts are not, and nothing here implies they are.
 *
 * [US-26]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/data/market-data.service';
import { WatchlistService } from '../../core/data/watchlist.service';
import { percentChangeOf } from '../../core/money/money';
import { isMarketOpenFor } from '../../core/domain/instrument';
import { Sparkline } from '../../shared/sparkline';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

@Component({
  selector: 'leap-watchlist-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Sparkline, InstrumentLogo, LivePrice],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Watchlist</h2>
        <span class="tag">{{ rows().length }}</span>
      </div>
      <ul>
        @for (row of rows(); track row.id) {
          <li>
            <a [routerLink]="['/instrument', row.id]">
              <leap-instrument-logo [instrumentId]="row.id" [symbol]="row.symbol" [size]="30" />
              <div class="left">
                <div class="sym">
                  {{ row.symbol }}
                  @if (!row.open) {
                    <i class="closed" title="Market closed"></i>
                  }
                </div>
                <div class="name faint">{{ row.name }}</div>
              </div>
              <leap-sparkline
                [points]="row.spark"
                [tone]="row.negative ? 'down' : 'up'"
                [width]="52"
                [height]="24"
              />
              <div class="right">
                <leap-live-price class="price" [value]="row.rate" [currency]="row.currency" />
                <div class="chg num" [class.up]="!row.negative" [class.down]="row.negative">
                  {{ row.negative ? '−' : '+' }}{{ row.change }}%
                </div>
              </div>
            </a>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li + li {
        border-top: 1px solid var(--border-soft);
      }
      a {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        transition: background 0.12s ease;
      }
      a:hover {
        background: var(--panel-hover);
      }
      .sym {
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .closed {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--text-3);
      }
      .name {
        font-size: 11px;
        margin-top: 1px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .right {
        text-align: right;
        min-width: 74px;
      }
      .price {
        font-size: 13px;
        font-weight: 650;
      }
      .chg {
        font-size: 11.5px;
        font-weight: 600;
        margin-top: 1px;
      }
    `,
  ],
})
export class WatchlistRail {
  private readonly market = inject(MarketDataService);
  private readonly watchlist = inject(WatchlistService);

  readonly rows = computed(() =>
    this.watchlist.instruments().map((instrument) => {
      const quote = this.market.latestQuote(instrument.id);
      // Rates, not Money — an FX pair moves in the 4th and 5th decimal place.
      const change = percentChangeOf(quote.previousCloseRate, quote.rate);
      return {
        id: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        rate: quote.rate,
        currency: quote.currency,
        change: change.abs().toString(),
        negative: change.isNegative(),
        open: isMarketOpenFor(instrument),
        spark: this.market.sparkline(instrument.id),
      };
    }),
  );
}
