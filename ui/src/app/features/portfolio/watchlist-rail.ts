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
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Watchlist</h2>
          <p class="panel-sub">Starred instruments</p>
        </div>
        <span class="count">{{ rows().length }}</span>
      </div>
      @if (rows().length === 0) {
        <p class="empty">
          <span class="star" aria-hidden="true">☆</span>
          Star instruments on <a class="lnk" routerLink="/markets">Markets</a> to follow them here.
        </p>
      } @else {
        <ul>
          @for (row of rows(); track row.id) {
            <li>
              <a [routerLink]="['/instrument', row.id]">
                <leap-instrument-logo [symbol]="row.symbol" [size]="36" />
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
    </section>
  `,
  styles: [
    `
      ul {
        list-style: none;
        margin: 0;
        padding: 6px 0;
      }
      li a {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 10px 22px;
        transition: background-color 0.12s ease;
      }
      li a:hover {
        background: var(--panel-hover);
      }
      .count {
        display: inline-grid;
        place-items: center;
        min-width: 26px;
        height: 24px;
        padding: 0 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 600;
      }
      .sym {
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .closed {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-3);
      }
      .name {
        font-size: 12.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .right {
        text-align: right;
        min-width: 80px;
      }
      .price {
        font-size: 14px;
        font-weight: 600;
      }
      .chg {
        font-size: 12px;
      }
      .empty {
        font-size: 13.5px;
      }
      .star {
        display: block;
        margin-bottom: 6px;
        font-size: 26px;
        line-height: 1;
        color: var(--warn);
      }
      .lnk {
        color: var(--accent);
        font-weight: 600;
      }
      .lnk:hover {
        text-decoration: underline;
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
