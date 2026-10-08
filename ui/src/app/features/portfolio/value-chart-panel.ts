import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountsService } from '../../core/api/accounts.service';
import { createLoader } from '../../core/api/loader';
import type { PriceRange } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatSignedPct, formatSignedUsd, formatStamp, formatUsd } from '../../shared/format';
import { PriceChart, type PricePoint } from '../../shared/price-chart';

/**
 * The active account's value (cash plus holdings) over a range, from
 * GET /accounts/{id}/value-history. The API works it out from filled orders and
 * recorded prices; the line ends at the live value shown in the hero.
 */
@Component({
  selector: 'leap-value-chart-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PriceChart],
  template: `
    <section class="panel">
      <div class="panel-head">
        <div class="head-text">
          <h2 class="panel-title">Value over time</h2>
          @if (change(); as c) {
            <p class="chg num" [class.up]="!c.negative" [class.down]="c.negative">
              @if (scrubbed()) {
                <span class="cursor">{{ scrubbedText() }}</span>
              }
              {{ c.deltaText }} · {{ c.percentText }}
              <span class="lbl">{{ scrubbed() ? 'at ' + c.at : range() }}</span>
            </p>
          } @else {
            <p class="panel-sub">Cash plus holdings, from filled orders</p>
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
          <leap-price-chart [points]="series()" [height]="260" [tone]="change()?.negative ? 'down' : 'up'" (scrub)="scrubbed.set($event)" />
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
        <p class="note faint">
          Cash plus each holding at the price recorded at that time, worked out from this account's filled orders.
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .body {
        padding: 18px 22px 18px;
      }
      .head-text {
        min-width: 0;
      }
      .chg {
        margin: 4px 0 0;
        font-size: 13.5px;
        font-weight: 600;
      }
      .cursor {
        color: var(--text);
        margin-right: 8px;
      }
      .lbl {
        font-weight: 500;
        margin-left: 4px;
        color: var(--text-3);
      }
      .chart-empty {
        display: grid;
        place-items: center;
        height: 260px;
        font-size: 13.5px;
      }
      .chart-empty p {
        margin: 0;
      }
      .note {
        margin: 14px 0 0;
        padding-top: 14px;
        border-top: 1px solid var(--border-soft);
        font-size: 12.5px;
      }
      @media (max-width: 560px) {
        .body {
          padding: 14px 16px;
        }
        .segmented {
          width: 100%;
          overflow-x: auto;
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
