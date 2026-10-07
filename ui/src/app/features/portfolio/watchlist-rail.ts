import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';

/** Starred instruments with their latest price, adapted from fe/21-page-mascots. */
@Component({
  selector: 'leap-watchlist-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Watchlist</h2>
        <span class="tag">{{ rows().length }}</span>
      </div>
      @if (rows().length === 0) {
        <p class="empty">Star instruments on <a class="lnk" routerLink="/markets">Markets</a> to follow them here.</p>
      } @else {
        <ul>
          @for (row of rows(); track row.id) {
            <li>
              <a [routerLink]="['/instrument', row.id]">
                <leap-instrument-logo [symbol]="row.symbol" [size]="30" />
                <div class="left">
                  <div class="sym">
                    {{ row.symbol }}
                    @if (!row.open) {
                      <i class="closed" title="Market closed"></i>
                    }
                  </div>
                  <div class="name faint">{{ row.name }}</div>
                </div>
                <div class="right">
                  @if (row.price != null) {
                    <leap-live-price class="price" [value]="row.price" />
                  } @else {
                    <span class="price faint">—</span>
                  }
                  <div class="chg faint">{{ row.exchange }}</div>
                </div>
              </a>
            </li>
          }
        </ul>
      }
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
      li a {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        transition: background 0.12s ease;
      }
      li a:hover {
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
        font-size: 11px;
        margin-top: 1px;
      }
      .empty {
        font-size: 12px;
      }
      .lnk {
        color: var(--accent);
      }
    `,
  ],
})
export class WatchlistRail {
  private readonly watchlist = inject(WatchlistService);
  private readonly market = inject(MarketStore);

  readonly rows = computed(() => {
    const now = this.market.now();
    return this.watchlist.instruments().map((i) => ({
      id: i.instrumentId,
      symbol: i.symbol,
      name: i.name,
      exchange: i.exchange,
      price: i.lastPrice ?? null,
      open: marketFor(i.exchange)?.isOpen(now) ?? true,
    }));
  });
}
