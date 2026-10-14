import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { AnalyticsInterval, VolumePoint } from '../../core/api/analytics.service';
import { formatUsd } from '../../shared/format';
import { compactUsd, periodLabel } from './analytics-format';

const WIDTH = 1000;
const HEIGHT = 260;
const MAX_X_LABELS = 8;

/**
 * Value traded per period as stacked bars: buys at the bottom, sells on top.
 * The SVG stretches to the panel width; axis labels and the tooltip are HTML so text never distorts.
 */
@Component({
  selector: 'leap-volume-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="hovered.set(null)">
      <div class="y-axis" aria-hidden="true">
        @for (tick of ticks(); track tick.value) {
          <span class="num" [style.top.%]="tick.top">{{ tick.label }}</span>
        }
      </div>
      <div class="plot">
        <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img" [attr.aria-label]="summary()">
          @for (tick of ticks(); track tick.value) {
            <line class="grid" x1="0" [attr.x2]="width" [attr.y1]="tick.y" [attr.y2]="tick.y" vector-effect="non-scaling-stroke" />
          }
          @for (bar of bars(); track bar.period; let i = $index) {
            <g [class.dimmed]="hovered() != null && hovered() !== i">
              <rect class="buy" [attr.x]="bar.x" [attr.width]="bar.w" [attr.y]="bar.buyY" [attr.height]="bar.buyH" />
              <rect class="sell" [attr.x]="bar.x" [attr.width]="bar.w" [attr.y]="bar.sellY" [attr.height]="bar.sellH" />
              <rect class="hit" [attr.x]="bar.slotX" [attr.width]="bar.slotW" y="0" [attr.height]="height" (mouseenter)="hovered.set(i)" />
            </g>
          }
        </svg>

        @if (tooltip(); as t) {
          <div class="tip" [style.left.%]="t.left" [class.flip]="t.left > 70" role="status">
            <p class="tip-title">{{ t.label }}</p>
            <p><i class="sw buy"></i>Buys <span class="num">{{ t.buy }}</span></p>
            <p><i class="sw sell"></i>Sells <span class="num">{{ t.sell }}</span></p>
            <p class="tip-total">Total <span class="num">{{ t.total }}</span></p>
            <p class="faint">{{ t.trades }}</p>
          </div>
        }

        <div class="x-axis" aria-hidden="true">
          @for (label of xLabels(); track label.left) {
            <span [style.left.%]="label.left">{{ label.text }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .chart {
        display: grid;
        grid-template-columns: 56px minmax(0, 1fr);
        gap: 8px;
      }
      .y-axis {
        position: relative;
        height: 260px;
      }
      .y-axis span {
        position: absolute;
        right: 0;
        transform: translateY(-50%);
        font-size: 11.5px;
        color: var(--text-3);
      }
      .plot {
        position: relative;
        min-width: 0;
      }
      svg {
        display: block;
        width: 100%;
        height: 260px;
        overflow: visible;
      }
      .grid {
        stroke: var(--border-soft);
        stroke-width: 1;
      }
      .buy {
        fill: var(--chart-up);
      }
      .sell {
        fill: var(--chart-down);
      }
      g {
        transition: opacity 0.15s ease;
      }
      g.dimmed {
        opacity: 0.35;
      }
      .hit {
        fill: transparent;
        cursor: crosshair;
      }
      .x-axis {
        position: relative;
        height: 24px;
      }
      .x-axis span {
        position: absolute;
        top: 8px;
        transform: translateX(-50%);
        font-size: 11.5px;
        color: var(--text-3);
        white-space: nowrap;
      }
      .tip {
        position: absolute;
        top: 8px;
        z-index: 2;
        min-width: 170px;
        padding: 10px 12px;
        margin-left: 12px;
        border-radius: var(--radius);
        background: var(--panel);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lift);
        font-size: 12.5px;
        pointer-events: none;
      }
      .tip.flip {
        transform: translateX(calc(-100% - 24px));
      }
      .tip p {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 2px 0;
      }
      .tip .num {
        margin-left: auto;
        font-weight: 600;
      }
      .tip-title {
        font-weight: 600;
        margin-bottom: 6px !important;
      }
      .tip-total {
        padding-top: 4px;
        border-top: 1px dashed var(--border-soft);
      }
      .sw {
        width: 8px;
        height: 8px;
        border-radius: 2px;
      }
      .sw.buy {
        background: var(--chart-up);
      }
      .sw.sell {
        background: var(--chart-down);
      }
    `,
  ],
})
export class VolumeBars {
  readonly points = input.required<readonly VolumePoint[]>();
  readonly interval = input.required<AnalyticsInterval>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly hovered = signal<number | null>(null);

  /** Top of the scale: four gridline steps of a round size ($10K, $25K, $40K…), just above the tallest bar. */
  private readonly scaleMax = computed(() => {
    const max = Math.max(0, ...this.points().map((p) => p.valueTraded));
    if (max === 0) return 1;
    const rough = max / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
    return step * 4;
  });

  protected readonly ticks = computed(() => {
    const top = this.scaleMax();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      value: top * f,
      label: compactUsd(top * f),
      y: HEIGHT - HEIGHT * f,
      top: 100 - f * 100,
    }));
  });

  protected readonly bars = computed(() => {
    const points = this.points();
    const slot = WIDTH / Math.max(points.length, 1);
    const w = Math.max(slot * 0.62, 1);
    const scale = HEIGHT / this.scaleMax();
    return points.map((p, i) => {
      const buyH = p.buyValue * scale;
      const sellH = p.sellValue * scale;
      return {
        period: p.period,
        slotX: i * slot,
        slotW: slot,
        x: i * slot + (slot - w) / 2,
        w,
        buyY: HEIGHT - buyH,
        buyH,
        sellY: HEIGHT - buyH - sellH,
        sellH,
      };
    });
  });

  protected readonly xLabels = computed(() => {
    const points = this.points();
    const every = Math.ceil(points.length / MAX_X_LABELS);
    const slot = 100 / Math.max(points.length, 1);
    return points
      .map((p, i) => ({ i, left: i * slot + slot / 2, text: periodLabel(p.period, this.interval(), true) }))
      .filter(({ i }) => i % every === 0);
  });

  protected readonly tooltip = computed(() => {
    const i = this.hovered();
    const p = i == null ? undefined : this.points()[i];
    if (i == null || !p) return null;
    const slot = 100 / this.points().length;
    return {
      left: i * slot + slot / 2,
      label: periodLabel(p.period, this.interval(), false),
      buy: formatUsd(p.buyValue),
      sell: formatUsd(p.sellValue),
      total: formatUsd(p.valueTraded),
      trades: `${p.trades} ${p.trades === 1 ? 'trade' : 'trades'}`,
    };
  });

  protected readonly summary = computed(() => {
    const points = this.points();
    const total = points.reduce((sum, p) => sum + p.valueTraded, 0);
    return `Value traded per ${this.interval()}, ${points.length} periods, ${formatUsd(total)} in total. Green is buys, red is sells.`;
  });
}
