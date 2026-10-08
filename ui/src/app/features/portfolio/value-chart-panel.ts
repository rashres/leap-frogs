import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountsService } from '../../core/api/accounts.service';
import { createLoader } from '../../core/api/loader';
import type { PriceRange } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatSignedPct, formatSignedUsd, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PriceChart, type PricePoint } from '../../shared/price-chart';

/**
 * The active account's value (cash plus holdings) over a range, from
 * GET /accounts/{id}/value-history. The API works it out from filled orders and
 * recorded prices; the line ends at the live value shown in the hero.
 */
@Component({
  selector: 'leap-value-chart-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PriceChart, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <div class="head-text">
          <h2 class="label">Portfolio performance</h2>
          <p class="value num">{{ scrubbed() ? scrubbedText() : totalText() }}</p>
          @if (change(); as c) {
            <p class="chg num" [class.up]="!c.negative" [class.down]="c.negative">
              <leap-icon [name]="c.negative ? 'trending-down' : 'trending-up'" [size]="14" />
              {{ c.percentText }} <span class="delta">{{ c.deltaText }}</span>
              <span class="lbl">{{ scrubbed() ? 'at ' + c.at : (range() === 'All' ? 'all time' : 'vs ' + range() + ' start') }}</span>
            </p>
          } @else {
            <p class="chg lbl">Cash plus holdings, from filled orders</p>
          }
        </div>
        <div class="segmented" role="group" aria-label="Chart range">
          @for (r of ranges; track r) {
            <button type="button" [class.on]="range() === r" [attr.aria-pressed]="range() === r" (click)="range.set(r)">{{ r }}</button>
          }
        </div>
      </div>

      <div class="body">
        @if (series().length >= 2) {
          <leap-price-chart [points]="series()" [height]="300" [axes]="true" [tone]="change()?.negative ? 'down' : 'up'" (scrub)="scrubbed.set($event)" />
        } @else {
          <div class="chart-empty">
            @if (history.initialLoading()) {
              <span class="skeleton" style="width: 100%; height: 100%; border-radius: 10px"></span>
              <span class="sr-only" role="status">Loading value history…</span>
            } @else if (history.error(); as e) {
              <p class="state-error">{{ e.message }}</p>
            } @else {
              <p class="faint">No value history for this account yet.</p>
            }
          </div>
        }
      </div>
      <p class="note faint">
        Cash plus each holding at the price recorded at that time, worked out from this account's filled orders.
      </p>
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
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px 16px;
        padding: 16px 20px 0;
      }
      .head-text {
        min-width: 0;
      }
      .label {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-2);
        letter-spacing: 0;
      }
      .value {
        margin: 4px 0 0;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }
      .chg {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin: 4px 0 0;
        font-size: 13px;
        font-weight: 600;
      }
      .delta {
        font-weight: 500;
      }
      .lbl {
        font-weight: 500;
        color: var(--text-3);
      }
      .body {
        flex: 1;
        padding: 12px 16px 4px 8px;
      }
      .chart-empty {
        display: grid;
        place-items: center;
        height: 300px;
        font-size: 13.5px;
      }
      .chart-empty p {
        margin: 0;
      }
      .note {
        margin: 0;
        padding: 10px 20px 14px;
        font-size: 12px;
      }
      @media (max-width: 560px) {
        .head {
          padding: 14px 16px 0;
        }
        .segmented {
          width: 100%;
        }
        .segmented button {
          flex: 1;
          min-width: 0;
        }
      }
    `,
  ],
})
export class ValueChartPanel {
  private readonly api = inject(AccountsService);
  private readonly account = inject(ActiveAccountService);
  private readonly orders = inject(OrdersService);
  private readonly portfolio = inject(PortfolioStore);

  readonly ranges: readonly PriceRange[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];
  readonly range = signal<PriceRange>('1M');
  readonly history = createLoader(() => this.api.valueHistory(this.account.activeId()!, this.range()));
  readonly scrubbed = signal<PricePoint | null>(null);

  /** Value per point, ending at the live total from the hero. Filter out flat lines (duplicate prices). */
  readonly series = computed<readonly PricePoint[]>(() => {
    const rawPoints = (this.history.data() ?? []).map((p) => ({ at: new Date(p.at), price: p.totalValue }));
    
    // Filter consecutive duplicates while keeping the first and last
    const points: PricePoint[] = [];
    for (let i = 0; i < rawPoints.length; i++) {
      if (i === 0 || rawPoints[i].price !== rawPoints[i - 1].price) {
        points.push(rawPoints[i]);
      }
    }
    
    const live = this.portfolio.totalValue();
    if (live != null && points.length && points[points.length - 1].price !== live) {
      points.push({ at: new Date(), price: live });
    }
    return points;
  });

  /** Change across the range, measured to the scrubbed point while hovering. */
  readonly change = computed(() => {
    const series = this.series();
    if (series.length < 2) return null;
    const open = series[0].price;
    const end = this.scrubbed() ?? series[series.length - 1];
    const delta = end.price - open;
    return {
      deltaText: formatSignedUsd(delta),
      percentText: open > 0 ? formatSignedPct((delta / open) * 100) : '—',
      negative: delta < 0,
      at: formatStamp(end.at),
    };
  });

  readonly scrubbedText = computed(() => formatUsd(this.scrubbed()?.price));
  readonly totalText = computed(() => formatUsd(this.portfolio.totalValue()));

  constructor() {
    effect(() => {
      const id = this.account.activeId();
      this.range();
      this.orders.changes();
      if (id == null) return;
      untracked(() => {
        this.scrubbed.set(null);
        this.history.reload();
      });
    });
    const refresh = setInterval(() => {
      if (this.account.activeId() != null) this.history.reload();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(refresh));
  }
}
