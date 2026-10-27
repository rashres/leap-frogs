import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountsService } from '../../core/api/accounts.service';
import { createLoader } from '../../core/api/loader';
import type { PriceRange } from '../../core/api/models';
import { OrdersService } from '../../core/api/orders.service';
import { IntradayService, portfolioIntraday, type IntradaySeries } from '../../core/markets/intraday.service';
import { marketFor } from '../../core/markets/sessions';
import { ActiveAccountService } from '../../core/state/active-account.service';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatSignedPct, formatSignedUsd, formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PriceChart, type PricePoint } from '../../shared/price-chart';
import { TPipe } from '../../core/i18n/t.pipe';
import { tk } from '../../core/i18n/i18n.service';

/** How often the live 1D line asks for new minutes; the API caches them for 10 seconds. */
const LIVE_REFRESH_MS = 15_000;

/**
 * The value of the active account's holdings over a range, from
 * GET /accounts/{id}/value-history (its holdingsValue; cash is left out, so
 * deposits and withdrawals do not show as performance). The API works it out
 * from filled orders and recorded prices; the line ends at the live value.
 */
@Component({
  selector: 'leap-value-chart-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, PriceChart, Icon],
  template: `
    <section class="panel card">
      <div class="head">
        <div class="head-text">
          <h2 class="label">{{ 'Portfolio performance' | t }}</h2>
          <p class="value num">{{ scrubbed() ? scrubbedText() : totalText() }}</p>
          @if (change(); as c) {
            <p class="chg num" [class.up]="!c.negative" [class.down]="c.negative">
              <leap-icon [name]="c.negative ? 'trending-down' : 'trending-up'" [size]="14" />
              {{ c.percentText }} <span class="delta">{{ c.deltaText }}</span>
              <span class="lbl">{{ scrubbed() ? ('at {time}' | t: { time: c.at }) : ((todayWindow() ? 'Today' : periods[range()]) | t) }}</span>
              @if (live()) {
                <span class="live-tag"><i aria-hidden="true"></i>{{ 'Live' | t }}</span>
              }
            </p>
          } @else {
            <p class="chg lbl">{{ 'Holdings value, from filled orders' | t }}</p>
          }
        </div>
        <div class="segmented" role="group" [attr.aria-label]="'Chart range' | t">
          @for (r of ranges; track r) {
            <button type="button" [class.on]="range() === r" [attr.aria-pressed]="range() === r" (click)="range.set(r)">{{ r | t }}</button>
          }
        </div>
      </div>

      <div class="body">
        @if (series().length >= 2) {
          <leap-price-chart
            [points]="series()"
            [height]="300"
            [axes]="true"
            [tone]="change()?.negative ? 'down' : 'up'"
            [window]="todayWindow()"
            [reference]="todayReference()"
            [live]="live()"
            (scrub)="scrubbed.set($event)"
          />
        } @else {
          <div class="chart-empty">
            @if (history.initialLoading() || todayLoading()) {
              <span class="skeleton" style="width: 100%; height: 100%; border-radius: 10px"></span>
              <span class="sr-only" role="status">{{ 'Loading value history…' | t }}</span>
            } @else if (history.error(); as e) {
              <p class="state-error">{{ e.message | t }}</p>
            } @else {
              <p class="faint">{{ 'No value history for this account yet.' | t }}</p>
            }
          </div>
        }
      </div>
      <p class="note faint">
        @if (todayWindow()) {
          {{ 'Today’s holdings at each minute’s price, previous close dotted. Cash is not included. Times in Central.' | t }}
        } @else {
          {{ 'Each holding at the price recorded at that time, worked out from this account’s filled orders. Cash is not included.' | t }}
        }
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
  private readonly market = inject(MarketStore);
  private readonly intraday = inject(IntradayService);

  readonly ranges: readonly PriceRange[] = ['1D', '1W', '1M', '3M', '1Y', 'All'];
  readonly range = signal<PriceRange>('1M');
  /** Plain-language name for the period the change is measured over. */
  readonly periods: Readonly<Record<PriceRange, string>> = {
    '1D': tk('Past day'),
    '1W': tk('Past week'),
    '1M': tk('Past month'),
    '3M': tk('Past 3 months'),
    '1Y': tk('Past year'),
    All: tk('All time'),
  };
  readonly history = createLoader(() => this.api.valueHistory(this.account.activeId()!, this.range()));
  readonly scrubbed = signal<PricePoint | null>(null);

  /** What today's line is built from; a new key means the line must be rebuilt. */
  private readonly todayKey = computed(() => {
    if (this.range() !== '1D' || !this.portfolio.holdings.data()) return null;
    const held = this.portfolio.positions().map((p) => `${p.symbol}:${p.quantity}`);
    return `${this.account.activeId()}|${held.join(',')}`;
  });
  /** 1D: today's value minute by minute from Yahoo; the recorded history is the fallback. */
  private readonly today = signal<{ key: string; series: IntradaySeries | null } | null>(null);
  private readonly todaySeries = computed(() => {
    const key = this.todayKey();
    const today = this.today();
    return key && today?.key === key ? today.series : undefined;
  });
  readonly todayLoading = computed(() => this.range() === '1D' && this.todaySeries() === undefined);
  readonly todayWindow = computed(() => {
    const t = this.todaySeries();
    return t ? { start: t.start, end: t.end } : null;
  });
  readonly todayReference = computed(() => this.todaySeries()?.previousClose ?? null);
  readonly live = computed(() => {
    const t = this.todaySeries();
    const now = this.market.now();
    if (!t || now < t.start || now > t.end) return false;
    return this.portfolio.positions().some((p) => marketFor(p.exchange)?.isOpen(now) ?? false);
  });

  /** Holdings value per point, ending at the live holdings value. Filter out flat lines (duplicate prices). */
  readonly series = computed<readonly PricePoint[]>(() => {
    const today = this.todaySeries();
    if (today) return today.points;
    if (today === undefined && this.range() === '1D') return [];
    const rawPoints = (this.history.data() ?? []).map((p) => ({ at: new Date(p.at), price: p.holdingsValue }));
    
    // Filter consecutive duplicates while keeping the first and last
    const points: PricePoint[] = [];
    for (let i = 0; i < rawPoints.length; i++) {
      if (i === 0 || rawPoints[i].price !== rawPoints[i - 1].price) {
        points.push(rawPoints[i]);
      }
    }
    
    const live = this.portfolio.marketValue();
    if (points.length && points[points.length - 1].price !== live) {
      points.push({ at: new Date(), price: live });
    }
    return points;
  });

  /** Change across the range, measured to the scrubbed point while hovering. */
  readonly change = computed(() => {
    const series = this.series();
    if (series.length < 2) return null;
    const open = this.todayReference() ?? series[0].price;
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
  readonly totalText = computed(() => formatUsd(this.todaySeries()?.points.at(-1)?.price ?? this.portfolio.marketValue()));

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

    effect(() => {
      const key = this.todayKey();
      if (key) untracked(() => void this.loadToday(key));
    });
    const tick = setInterval(() => {
      const key = this.todayKey();
      if (key && document.visibilityState === 'visible') void this.loadToday(key);
    }, LIVE_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  private async loadToday(key: string): Promise<void> {
    const positions = this.portfolio.positions();
    const loaded = await Promise.all(positions.map((p) => this.intraday.series(p.symbol)));
    const series = loaded.every((s) => s != null)
      ? portfolioIntraday(positions.map((p, i) => ({ quantity: p.quantity, series: loaded[i]! })), 0)
      : null;
    if (this.todayKey() !== key) return;
    // A failed refresh keeps the line already drawn.
    if (!series && this.today()?.key === key && this.today()?.series) return;
    this.today.set({ key, series });
  }
}
