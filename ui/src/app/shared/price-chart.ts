/**
 * Interactive price chart: an inline SVG path, no charting library. Adapted
 * from fe/21-page-mascots (shared/price-chart.ts) to plain USD numbers.
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
import { formatPrice } from './format';

export interface PricePoint {
  readonly at: Date;
  readonly price: number;
}

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly line: string;
  readonly area: string;
  readonly baselineY: number;
  readonly rising: boolean;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly plotLeft: number;
  readonly plotWidth: number;
  readonly plotBottom: number;
  readonly yTicks: readonly { y: number; label: string }[];
  readonly xTicks: readonly { x: number; label: string; anchor: string }[];
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

          @for (t of geo.yTicks; track t.y) {
            <line class="grid" [attr.x1]="geo.plotLeft" [attr.y1]="t.y" [attr.x2]="geo.width" [attr.y2]="t.y" />
            <text class="axis" [attr.x]="geo.plotLeft - 10" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.label }}</text>
          }
          @for (t of geo.xTicks; track t.x) {
            <text class="axis" [attr.x]="t.x" [attr.y]="geo.height - 4" [attr.text-anchor]="t.anchor">{{ t.label }}</text>
          }

          <!-- Opening reference, the level the day's change is measured from. -->
          <line
            class="baseline"
            [attr.x1]="geo.plotLeft"
            [attr.y1]="geo.baselineY"
            [attr.x2]="geo.width"
            [attr.y2]="geo.baselineY"
          />

          <path [attr.d]="geo.area" [attr.fill]="'url(#' + gradientId + ')'" />
          <path
            [attr.d]="geo.line"
            fill="none"
            [attr.stroke]="strokeColour()"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          @if (idx !== null) {
            <line class="crosshair" [attr.x1]="geo.xs[idx]" y1="0" [attr.x2]="geo.xs[idx]" [attr.y2]="geo.plotBottom" />
            <circle
              [attr.cx]="geo.xs[idx]"
              [attr.cy]="geo.ys[idx]"
              r="4.5"
              [attr.fill]="strokeColour()"
              stroke="var(--panel)"
              stroke-width="2.5"
            />
          }
        </svg>

        @if (idx !== null) {
          <div class="scrub num" [style.left.px]="geo.xs[idx]">
            {{ usd(points()[idx].price) }}
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
        stroke-dasharray: 4 4;
        opacity: 0.8;
      }
      .grid {
        stroke: var(--border-soft);
        stroke-width: 1;
      }
      .axis {
        fill: var(--text-3);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .crosshair {
        stroke: var(--text-3);
        stroke-width: 1;
        stroke-dasharray: 3 3;
      }
      .scrub {
        position: absolute;
        top: -4px;
        transform: translateX(-50%);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-2);
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
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
  /** Value labels on the left, time labels underneath, and horizontal gridlines. */
  readonly axes = input(false);

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
    const axes = this.axes();
    // Headroom so the line and its hover dot never clip against the edges.
    const padTop = 14;
    const padBottom = axes ? 28 : 10;
    const plotLeft = axes ? 62 : 0;
    const plotWidth = Math.max(40, width - plotLeft - (axes ? 6 : 0));

    const values = points.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) * 0.01 || 1;

    const plot = height - padTop - padBottom;
    const plotBottom = height - padBottom;
    const yOf = (v: number) => padTop + plot - ((v - min) / span) * plot;
    const xs = values.map((_, i) => plotLeft + (i / (values.length - 1)) * plotWidth);
    const ys = values.map(yOf);

    const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' ');
    const area = `${line} L${xs[xs.length - 1]},${plotBottom} L${plotLeft},${plotBottom} Z`;
    const baselineY = yOf(values[0]);

    const yTicks: { y: number; label: string }[] = [];
    let xTicks: { x: number; label: string; anchor: string }[] = [];
    if (axes) {
      const step = niceStep(span / 4);
      for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
        yTicks.push({ y: yOf(v), label: axisPrice(v, step) });
      }
      const count = Math.min(6, points.length);
      const spanMs = points[points.length - 1].at.getTime() - points[0].at.getTime();
      xTicks = Array.from({ length: count }, (_, k) => {
        const i = Math.round((k / (count - 1)) * (points.length - 1));
        return {
          x: xs[i],
          label: axisTime(points[i].at, spanMs),
          anchor: k === 0 ? 'start' : k === count - 1 ? 'end' : 'middle',
        };
      });
    }

    return {
      width,
      height,
      line,
      area,
      baselineY,
      rising: values[values.length - 1] >= values[0],
      xs,
      ys,
      plotLeft,
      plotWidth,
      plotBottom,
      yTicks,
      xTicks,
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
    const values = points.map((p) => p.price);
    const direction = close > open ? 'up' : close < open ? 'down' : 'flat';
    return (
      `Price chart over ${points.length} points. ` +
      `Opened ${formatPrice(open)}, closed ${formatPrice(close)}, ${direction}. ` +
      `Low ${formatPrice(Math.min(...values))}, high ${formatPrice(Math.max(...values))}.`
    );
  });

  readonly strokeColour = computed(() => {
    const tone = this.tone();
    if (tone === 'up') return 'var(--chart-up)';
    if (tone === 'down') return 'var(--chart-down)';
    return this.geometry()?.rising ? 'var(--chart-up)' : 'var(--chart-down)';
  });

  onMove(event: PointerEvent): void {
    const geo = this.geometry();
    if (!geo) return;
    const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left - geo.plotLeft) / geo.plotWidth));
    const index = Math.min(this.points().length - 1, Math.max(0, Math.round(ratio * (this.points().length - 1))));
    this.hoverIndex.set(index);
    this.scrub.emit(this.points()[index]);
  }

  onLeave(): void {
    this.hoverIndex.set(null);
    this.scrub.emit(null);
  }

  usd(value: number): string {
    return formatPrice(value);
  }

  formatTime(at: Date): string {
    const ageMs = Date.now() - at.getTime();
    const withinDay = ageMs < 24 * 60 * 60 * 1000;
    return withinDay
      ? at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

function axisPrice(value: number, step: number): string {
  const decimals = (x: number) => Math.min(4, Math.max(0, Math.ceil(-Math.log10(x))));
  if (Math.abs(value) >= 10_000) {
    const d = decimals(step / 1000);
    return `$${(value / 1000).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}k`;
  }
  const d = decimals(step);
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

function axisTime(at: Date, spanMs: number): string {
  return spanMs <= 36 * 60 * 60 * 1000
    ? at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
