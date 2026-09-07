/**
 * Interactive price chart.
 *
 * Deliberately dependency-free: an inline SVG path, no charting library. The
 * only float arithmetic in here is pixel geometry, which is why Decimal exposes
 * `unsafeToNumberForChartGeometry()` — see decimal.ts for why that name is what
 * it is. No value produced here is ever shown as a figure or fed back into a
 * balance; the numbers beside the chart come from Decimal formatting.
 *
 * [US-16]
 */

import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { PricePoint } from '../core/data/fixtures';

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly line: string;
  readonly area: string;
  readonly baselineY: number;
  readonly rising: boolean;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
}

@Component({
  selector: 'leap-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let geo = geometry();
    @let idx = hoverIndex();
    <div class="chart" [style.height.px]="height()">
      @if (geo) {
        <svg
          [attr.width]="geo.width"
          [attr.height]="geo.height"
          [attr.viewBox]="'0 0 ' + geo.width + ' ' + geo.height"
          role="img"
          [attr.aria-label]="summary()"
          (pointermove)="onMove($event)"
          (pointerleave)="onLeave()"
        >
          <defs>
            <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="strokeColour()" stop-opacity="0.22" />
              <stop offset="100%" [attr.stop-color]="strokeColour()" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Opening reference, the level the day's change is measured from. -->
          <line
            class="baseline"
            x1="0"
            [attr.y1]="geo.baselineY"
            [attr.x2]="geo.width"
            [attr.y2]="geo.baselineY"
          />

          <path [attr.d]="geo.area" [attr.fill]="'url(#' + gradientId + ')'" />
          <path
            [attr.d]="geo.line"
            fill="none"
            [attr.stroke]="strokeColour()"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          @if (idx !== null) {
            <line class="crosshair" [attr.x1]="geo.xs[idx]" y1="0" [attr.x2]="geo.xs[idx]" [attr.y2]="geo.height" />
            <circle
              [attr.cx]="geo.xs[idx]"
              [attr.cy]="geo.ys[idx]"
              r="4.5"
              [attr.fill]="strokeColour()"
              stroke="#000"
              stroke-width="2"
            />
          }
        </svg>

        @if (idx !== null) {
          <div class="scrub num" [style.left.px]="geo.xs[idx]">
            {{ points()[idx].price.toGroupedString() }}
            <span class="scrub-time">{{ formatTime(points()[idx].at) }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      /* Must be block: the host measures its own width to size the SVG, and an
         inline host collapses to its content instead of filling its container. */
      :host {
        display: block;
        width: 100%;
      }
      .chart {
        position: relative;
        width: 100%;
        touch-action: none;
      }
      svg {
        display: block;
        cursor: crosshair;
      }
      .baseline {
        stroke: var(--border-strong);
        stroke-width: 1;
        stroke-dasharray: 3 4;
        opacity: 0.65;
      }
      .crosshair {
        stroke: var(--border-strong);
        stroke-width: 1;
      }
      .scrub {
        position: absolute;
        top: -4px;
        transform: translateX(-50%);
        background: var(--panel-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 650;
        white-space: nowrap;
        pointer-events: none;
      }
      .scrub-time {
        color: var(--text-3);
        margin-left: 6px;
        font-weight: 500;
      }
    `,
  ],
})
export class PriceChart {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly points = input.required<readonly PricePoint[]>();
  readonly height = input(300);
  /** Overrides the rising/falling colour when the parent already knows the tone. */
  readonly tone = input<'auto' | 'up' | 'down'>('auto');

  /** Emits the scrubbed point so the parent can retitle its headline figure. */
  readonly scrub = output<PricePoint | null>();

  readonly gradientId = `chart-grad-${Math.random().toString(36).slice(2, 9)}`;

  private readonly width = signal(720);
  readonly hoverIndex = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      const element = this.host.nativeElement as HTMLElement;
      const observer = new ResizeObserver(([entry]) => {
        const next = Math.max(120, Math.floor(entry.contentRect.width));
        this.width.set(next);
      });
      observer.observe(element);
      this.width.set(Math.max(120, Math.floor(element.getBoundingClientRect().width)) || 720);
    });
  }

  readonly geometry = computed<Geometry | null>(() => {
    const points = this.points();
    if (points.length < 2) return null;

    const width = this.width();
    const height = this.height();
    // Headroom so the line and its hover dot never clip against the edges.
    const padTop = 14;
    const padBottom = 10;

    const values = points.map((p) => p.price.unsafeToNumberForChartGeometry());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) * 0.01 || 1;

    const plot = height - padTop - padBottom;
    const xs = values.map((_, i) => (i / (values.length - 1)) * width);
    const ys = values.map((v) => padTop + plot - ((v - min) / span) * plot);

    const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;
    const baselineY = padTop + plot - ((values[0] - min) / span) * plot;

    return {
      width,
      height,
      line,
      area,
      baselineY,
      rising: values[values.length - 1] >= values[0],
      xs,
      ys,
    };
  });

  /**
   * Text equivalent of the line.
   *
   * The chart is scrubbable with a pointer, which assistive tech cannot do, so
   * the shape is described instead: where it opened, where it closed, and the
   * range in between.
   */
  readonly summary = computed(() => {
    const points = this.points();
    if (points.length < 2) return 'Price chart, no data available.';
    const open = points[0].price;
    const close = points[points.length - 1].price;
    let low = open;
    let high = open;
    for (const point of points) {
      if (point.price.lessThan(low)) low = point.price;
      if (point.price.greaterThan(high)) high = point.price;
    }
    const direction = close.greaterThan(open) ? 'up' : close.lessThan(open) ? 'down' : 'flat';
    return (
      `Price chart over ${points.length} points. ` +
      `Opened ${open.toGroupedString()}, closed ${close.toGroupedString()}, ${direction}. ` +
      `Low ${low.toGroupedString()}, high ${high.toGroupedString()}.`
    );
  });

  readonly strokeColour = computed(() => {
    const tone = this.tone();
    if (tone === 'up') return 'var(--up)';
    if (tone === 'down') return 'var(--down)';
    return this.geometry()?.rising ? 'var(--up)' : 'var(--down)';
  });

  onMove(event: PointerEvent): void {
    const geo = this.geometry();
    if (!geo) return;
    const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.min(this.points().length - 1, Math.max(0, Math.round(ratio * (this.points().length - 1))));
    this.hoverIndex.set(index);
    this.scrub.emit(this.points()[index]);
  }

  onLeave(): void {
    this.hoverIndex.set(null);
    this.scrub.emit(null);
  }

  formatTime(at: Date): string {
    const ageMs = Date.now() - at.getTime();
    const withinDay = ageMs < 24 * 60 * 60 * 1000;
    return withinDay
      ? at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }
}
