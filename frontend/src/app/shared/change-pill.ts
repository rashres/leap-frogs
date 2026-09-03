/**
 * Signed percentage pill, coloured by direction.
 *
 * [US-12]
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Decimal } from '../core/money/decimal';

@Component({
  selector: 'leap-change-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pill num" [class.pill-up]="!negative()" [class.pill-down]="negative()">
      {{ negative() ? '−' : '+' }}{{ magnitude() }}%
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
    `,
  ],
})
export class ChangePill {
  readonly percent = input.required<Decimal>();

  readonly negative = computed(() => this.percent().isNegative());
  readonly magnitude = computed(() => this.percent().abs().rescale(2, 'HALF_EVEN').toString());
}
