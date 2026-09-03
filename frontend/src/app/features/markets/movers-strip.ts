/**
 * Today's biggest gainers and losers across the instrument universe.
 *
 * SCOPE NOTE. This is a ranking of quote data the client can already see on
 * this page — pure PS-04 market data, no client information involved. It is
 * deliberately NOT the cross-client analytics of US-21/US-23: those are PS-06
 * stories that must run against the separate reporting store under BR-16, and
 * computing them here over the trading read model would be exactly the defect
 * CLAUDE.md warns about. See docs/open-questions.md OQ-12.
 *
 * [US-15]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/data/market-data.service';
import { percentChangeOf } from '../../core/money/money';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

const SHOWN_PER_SIDE = 4;

@Component({
  selector: 'leap-movers-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice],
  template: `
    <div class="grid">
      @for (side of sides(); track side.key) {
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">
              <span class="arrow" [class.up]="side.key === 'gainers'" [class.down]="side.key === 'losers'">
                {{ side.key === 'gainers' ? '▲' : '▼' }}
              </span>
              {{ side.label }}
            </h2>
            <span class="tag">Today</span>
          </div>

          @if (side.rows.length === 0) {
            <p class="empty">Nothing moving yet.</p>
          } @else {
            <ul>
              @for (row of side.rows; track row.id) {
                <li>
                  <a [routerLink]="['/instrument', row.id]">
                    <span class="rank faint num">{{ $index + 1 }}</span>
                    <leap-instrument-logo [instrumentId]="row.id" [symbol]="row.symbol" [size]="26" />
                    <span class="sym">{{ row.symbol }}</span>
                    <leap-live-price class="price" [value]="row.rate" [currency]="row.currency" />
                    <span class="chg num" [class.up]="!row.negative" [class.down]="row.negative">
                      {{ row.negative ? '−' : '+' }}{{ row.change }}%
                    </span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
        margin-bottom: 18px;
      }
      .arrow {
        font-size: 9px;
        margin-right: 5px;
      }
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
        grid-template-columns: 16px auto minmax(0, 1fr) auto 74px;
        align-items: center;
        gap: 10px;
        padding: 9px 16px;
        transition: background 0.12s ease;
      }
      a:hover {
        background: var(--panel-hover);
      }
      .rank {
        font-size: 10.5px;
      }
      .sym {
        font-size: 13px;
        font-weight: 700;
      }
      .price {
        font-size: 12.5px;
        font-weight: 620;
        color: var(--text-2);
      }
      .chg {
        text-align: right;
        font-size: 12.5px;
        font-weight: 700;
      }
    `,
  ],
})
export class MoversStrip {
  private readonly market = inject(MarketDataService);

  /**
   * Tradeable instruments ranked by today's move against previous close.
   *
   * Suspended instruments are excluded deliberately. A suspended line in "Top
   * gainers" reads as an opportunity and invites a click that pre-trade
   * validation will reject with INSTRUMENT_NOT_TRADEABLE — surfacing it here
   * would be promoting something the platform will refuse to trade.
   */
  private readonly ranked = computed(() =>
    this.market.instruments
      .filter((instrument) => instrument.tradeable)
      .map((instrument) => {
        const quote = this.market.latestQuote(instrument.id);
        const change = percentChangeOf(quote.previousCloseRate, quote.rate);
        return {
          id: instrument.id,
          symbol: instrument.symbol,
          rate: quote.rate,
          currency: quote.currency,
          percent: change,
          change: change.abs().toString(),
          negative: change.isNegative(),
        };
      })
      // Descending by signed change, so gainers head the list and losers tail it.
      .sort((a, b) => b.percent.compareTo(a.percent)),
  );

  readonly sides = computed(() => {
    const ranked = this.ranked();
    return [
      {
        key: 'gainers' as const,
        label: 'Top gainers',
        rows: ranked.filter((r) => !r.negative).slice(0, SHOWN_PER_SIDE),
      },
      {
        key: 'losers' as const,
        label: 'Top losers',
        rows: ranked
          .filter((r) => r.negative)
          .slice(-SHOWN_PER_SIDE)
          .reverse(),
      },
    ];
  });
}
