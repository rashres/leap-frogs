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
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Value over time</h2>
        @if (change(); as c) {
          <span class="chg num" [class.up]="!c.negative" [class.down]="c.negative">
            @if (scrubbed()) {
              <span class="cursor">{{ scrubbedText() }}</span>
            }
            {{ c.deltaText }} · {{ c.percentText }}
            <span class="faint lbl">{{ scrubbed() ? 'at ' + c.at : range() }}</span>
          </span>
        }
      </div>

      <div class="body">
        @if (series().length >= 2) {
          <leap-price-chart [points]="series()" [height]="220" [tone]="change()?.negative ? 'down' : 'up'" (scrub)="scrubbed.set($event)" />
        } @else {
          <div class="chart-empty faint">
            @if (history.initialLoading()) {
              Loading value history…
            } @else if (history.error(); as e) {
              {{ e.message }}
            } @else {
              No value history for this account yet.
            }
          </div>
        }

        <div class="ranges">
          @for (r of ranges; track r) {
            <button type="button" [class.on]="range() === r" (click)="range.set(r)">{{ r }}</button>
          }
        </div>
        <p class="note faint">
          Cash plus each holding at the price recorded at that time, worked out from this account's filled orders.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .body {
        padding: 6px 18px 14px;
      }
      .chg {
        font-size: 13px;
        font-weight: 650;
      }
      .cursor {
        color: var(--text);
        margin-right: 8px;
      }
      .lbl {
        font-weight: 500;
        margin-left: 4px;
        font-size: 11.5px;
      }
      .chart-empty {
        display: grid;
        place-items: center;
        height: 220px;
        font-size: 12.5px;
      }
      .ranges {
        display: flex;
        gap: 4px;
        border-top: 1px solid var(--border-soft);
        padding-top: 11px;
      }
      .ranges button {
        padding: 5px 14px;
        border-radius: var(--radius-sm);
        font-size: 12.5px;
        font-weight: 650;
        color: var(--text-3);
        transition: all 0.13s ease;
      }
      .ranges button:hover {
        color: var(--text);
        background: var(--panel-2);
      }
      .ranges button.on {
        color: var(--up);
        background: var(--up-soft);
      }
      .note {
        margin: 10px 0 0;
        font-size: 11.5px;
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
