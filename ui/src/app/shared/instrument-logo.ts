/**
 * Circular instrument tile: brand mark, FX pair, or tinted ticker monogram.
 * Adapted from the team's Angular app (fe/21-page-mascots, shared/instrument-logo.ts).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { brandFor, fxPair } from './brand';
import { BRAND_MARK_PATHS } from './brand-marks';

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  INR: '₹',
  JPY: '¥',
};

@Component({
  selector: 'leap-instrument-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = brand();
    <span
      class="tile"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="b.bg"
      role="img"
      [attr.aria-label]="symbol() + ' logo'"
    >
      @if (markPath(); as d) {
        <svg viewBox="0 0 24 24" [attr.width]="inner()" [attr.height]="inner()" aria-hidden="true">
          @if (b.gradient; as g) {
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" [attr.stop-color]="g[0]" />
                <stop offset="100%" [attr.stop-color]="g[1]" />
              </linearGradient>
            </defs>
          }
          <path [attr.d]="d" [attr.fill]="b.gradient ? 'url(#' + gradientId + ')' : b.fg" />
        </svg>
      } @else {
        @switch (b.glyph) {
          @case ('microsoft') {
            <svg viewBox="0 0 24 24" [attr.width]="inner()" [attr.height]="inner()" aria-hidden="true">
              <rect x="2" y="2" width="9.2" height="9.2" fill="#f25022" />
              <rect x="12.8" y="2" width="9.2" height="9.2" fill="#7fba00" />
              <rect x="2" y="12.8" width="9.2" height="9.2" fill="#00a4ef" />
              <rect x="12.8" y="12.8" width="9.2" height="9.2" fill="#ffb900" />
            </svg>
          }
          @case ('fx') {
            <span class="fx" [style.color]="b.fg" [style.fontSize.px]="size() * 0.36" aria-hidden="true">
              <i>{{ pair().base }}</i><i class="q">{{ pair().quote }}</i>
            </span>
          }
          @default {
            <span class="mono" [style.color]="b.fg" [style.fontSize.px]="size() * 0.42" aria-hidden="true">{{
              b.mono
            }}</span>
          }
        }
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      .tile {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: inset 0 0 0 1px var(--logo-ring);
      }
      .mono {
        font-weight: 750;
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .fx {
        display: inline-flex;
        align-items: center;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.04em;
      }
      .fx i {
        font-style: normal;
      }
      .fx .q {
        opacity: 0.55;
        margin-left: 1px;
      }
      svg {
        display: block;
      }
    `,
  ],
})
export class InstrumentLogo {
  readonly symbol = input.required<string>();
  readonly size = input(34);

  readonly gradientId = `mark-${Math.random().toString(36).slice(2, 9)}`;

  readonly brand = computed(() => brandFor(this.symbol()));

  readonly markPath = computed(() => {
    const mark = this.brand().mark;
    return mark ? BRAND_MARK_PATHS[mark] : null;
  });

  readonly inner = computed(() => Math.round(this.size() * 0.56));

  readonly pair = computed(() => {
    const pair = fxPair(this.symbol());
    return {
      base: pair ? (CURRENCY_SYMBOLS[pair.base] ?? pair.base[0]) : '?',
      quote: pair ? (CURRENCY_SYMBOLS[pair.quote] ?? pair.quote[0]) : '',
    };
  });
}
