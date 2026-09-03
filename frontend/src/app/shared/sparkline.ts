/**
 * Compact non-interactive price line for list rows.
 *
 * [US-12][US-26]
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PricePoint } from '../core/data/fixtures';

@Component({
  selector: 'leap-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = path();
    @if (d) {
      <!-- Decorative: every sparkline sits beside the same instrument's price
           and percentage change, so announcing it again adds only noise. -->
      <svg
        [attr.width]="width()"
        [attr.height]="height()"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        aria-hidden="true"
      >
        <path
          [attr.d]="d"
          fill="none"
          [attr.stroke]="stroke()"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        line-height: 0;
      }
    `,
  ],
})
export class Sparkline {
  readonly points = input.required<readonly PricePoint[]>();
  readonly width = input(72);
  readonly height = input(28);

  /**
   * Overrides the line colour.
   *
   * 'auto' tones off the first-to-last point of the series, which is NOT the
   * same baseline as a day-change percentage measured against previous close.
   * Wherever a percentage is shown beside the line, pass the tone explicitly so
   * the two cannot disagree.
   */
  readonly tone = input<'auto' | 'up' | 'down'>('auto');

  private readonly values = computed(() =>
    this.points().map((p) => p.price.unsafeToNumberForChartGeometry()),
  );

  readonly rising = computed(() => {
    const values = this.values();
    return values.length > 1 ? values[values.length - 1] >= values[0] : true;
  });

  readonly stroke = computed(() => {
    const tone = this.tone();
    if (tone === 'up') return 'var(--up)';
    if (tone === 'down') return 'var(--down)';
    return this.rising() ? 'var(--up)' : 'var(--down)';
  });

  readonly path = computed<string | null>(() => {
    const values = this.values();
    if (values.length < 2) return null;
    const width = this.width();
    const height = this.height();
    const pad = 3;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const plot = height - pad * 2;

    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = pad + plot - ((v - min) / span) * plot;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
}
