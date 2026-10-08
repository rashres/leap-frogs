import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PricePoint } from './price-chart';

let nextId = 0;

/** Tiny trend line for table rows. Decorative: the row states the change in text. */
@Component({
  selector: 'leap-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shape(); as s) {
      <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="s.colour" stop-opacity="0.22" />
            <stop offset="100%" [attr.stop-color]="s.colour" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path [attr.d]="s.area" [attr.fill]="'url(#' + gradientId + ')'" />
        <path [attr.d]="s.line" fill="none" [attr.stroke]="s.colour" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
    } @else {
      <span class="none" aria-hidden="true">—</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }
      svg {
        display: block;
      }
      .none {
        color: var(--text-3);
      }
    `,
  ],
})
export class Sparkline {
  protected readonly gradientId = `spark-${nextId++}`;
  readonly points = input.required<readonly PricePoint[]>();
  readonly width = input(96);
  readonly height = input(30);

  readonly shape = computed(() => {
    const values = this.points().map((p) => p.price);
    if (values.length < 2) return null;
    const w = this.width();
    const h = this.height();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 2;
    const xs = values.map((_, i) => (i / (values.length - 1)) * w);
    const ys = values.map((v) => pad + (h - 2 * pad) * (1 - (v - min) / span));
    const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    return {
      line,
      area: `${line} L${w},${h} L0,${h} Z`,
      colour: values[values.length - 1] >= values[0] ? 'var(--chart-up)' : 'var(--chart-down)',
    };
  });
}
