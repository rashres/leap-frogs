import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { WatchlistService } from '../../core/state/watchlist.service';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { LivePrice } from '../../shared/live-price';
import { Icon } from '../../shared/icon';
import { formatSignedPct } from '../../shared/format';
import { DayChangeStore } from './day-change.store';

/** Starred instruments with their latest price, adapted from fe/21-page-mascots. */
@Component({
  selector: 'leap-watchlist-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo, LivePrice, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <h2 class="panel-title">My watchlist</h2>
        <span class="count">{{ rows().length }}</span>
      </div>
      @if (rows().length === 0) {
        <div class="empty">
          <leap-icon name="star" [size]="20" />
          <p>Star instruments on Markets to follow them here.</p>
        </div>
      } @else {
        <ul class="list">
          @for (row of rows(); track row.id) {
            <li>
              <a [routerLink]="['/instrument', row.id]">
                <leap-instrument-logo [symbol]="row.symbol" [size]="34" />
                <div class="left">
                  <div class="sym">
                    {{ row.symbol }}
                    @if (!row.open) {
                      <i class="closed" title="Market closed"></i>
                    }
                  </div>
                  <div class="name">{{ row.name }}</div>
                </div>
                <div class="right">
                  @if (row.price != null) {
                    <leap-live-price class="price" [value]="row.price" />
                  } @else {
                    <span class="price faint">—</span>
                  }
                  @if (row.pct; as pct) {
                    <div class="chg num" [class.up]="!row.negative" [class.down]="row.negative">
                      <leap-icon [name]="row.negative ? 'trending-down' : 'trending-up'" [size]="12" />{{ pct }}
                    </div>
                  } @else {
                    <div class="chg faint">{{ row.exchange }}</div>
                  }
                </div>
              </a>
            </li>
          }
        </ul>
      }
      <div class="foot">
        <a class="btn btn-secondary btn-sm" routerLink="/markets"><span aria-hidden="true">+</span> Add from Markets</a>
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
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 8px;
      }
      .count {
        display: inline-grid;
        place-items: center;
        min-width: 24px;
        height: 22px;
        padding: 0 7px;
        border-radius: 999px;
        background: var(--panel-3);
        color: var(--text-2);
        font-size: 12px;
        font-weight: 600;
      }
      /* Basis 0 so the chart beside it sets the row height; the list scrolls. */
      .list {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        list-style: none;
        margin: 0;
        padding: 0 8px;
      }
      li a {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border-radius: var(--radius);
        transition: background-color 0.12s ease;
      }
      li a:hover {
        background: var(--panel-hover);
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
        font-size: 12px;
        color: var(--text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .price {
        font-size: 14px;
        font-weight: 600;
      }
      .chg {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 12px;
        font-weight: 600;
      }
      .empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px;
        color: var(--warn);
        text-align: center;
      }
      .empty p {
        margin: 0;
        max-width: 26ch;
        font-size: 13px;
        color: var(--text-3);
      }
      .foot {
        padding: 10px 20px 16px;
      }
      .foot .btn {
        width: 100%;
      }
      @media (max-width: 1100px) {
        .list {
          flex: none;
          max-height: 360px;
        }
      }
    `,
  ],
})
export class WatchlistRail {
  private readonly watchlist = inject(WatchlistService);
  private readonly market = inject(MarketStore);
  private readonly day = inject(DayChangeStore, { optional: true });

  readonly rows = computed(() => {
    const now = this.market.now();
    return this.watchlist.instruments().map((i) => ({
      id: i.instrumentId,
      symbol: i.symbol,
      name: i.name,
      exchange: i.exchange,
      price: i.lastPrice ?? null,
      open: marketFor(i.exchange)?.isOpen(now) ?? true,
      ...this.change(i.instrumentId),
    }));
  });

  private change(id: number): { pct: string | null; negative: boolean } {
    const row = this.day?.byId().get(id);
    return { pct: row?.changePct != null ? formatSignedPct(row.changePct) : null, negative: (row?.change ?? 0) < 0 };
  }
}
