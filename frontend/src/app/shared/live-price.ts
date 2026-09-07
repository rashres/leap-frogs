/**
 * A price that flashes on change.
 *
 * Every broker terminal does this and it carries real information: it tells you
 * the number in front of you is live and which way it just moved. The flash is
 * driven by comparing Decimals, not formatted strings, so a move too small to
 * change the rendered text does not produce a phantom flash.
 *
 * Formats via formatRate, so the value is shown at its own precision — an FX
 * rate keeps 5dp while a cash amount stays at the currency's minor unit.
 *
 * [US-16]
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Decimal } from '../core/money/decimal';
import { formatRate } from '../core/money/money';
import type { CurrencyCode } from '../core/money/currency';

const FLASH_MS = 480;

@Component({
  selector: 'leap-live-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="num" [class.up-tick]="flash() === 'up'" [class.down-tick]="flash() === 'down'">{{
    text()
  }}</span>`,
  styles: [
    `
      :host {
        display: inline-block;
      }
      span {
        display: inline-block;
        border-radius: 4px;
        padding: 0 3px;
        margin: 0 -3px;
        /* Background only — never the text colour. The digits sit next to a
           day-change column that already uses red/green to mean something else,
           and recolouring the price would put two conflicting signals side by
           side: a price can tick down inside a day that is up. Terminals flash
           the cell, not the number, for exactly this reason. */
        transition: background-color 0.4s ease, box-shadow 0.4s ease;
      }
      .up-tick {
        background: var(--up-soft);
        box-shadow: inset 0 -1px 0 var(--up);
      }
      .down-tick {
        background: var(--down-soft);
        box-shadow: inset 0 -1px 0 var(--down);
      }
      @media (prefers-reduced-motion: reduce) {
        span {
          transition: none;
        }
      }
    `,
  ],
})
export class LivePrice {
  readonly value = input.required<Decimal>();
  readonly currency = input.required<CurrencyCode>();

  readonly text = computed(() => formatRate(this.value(), this.currency()));
  readonly flash = signal<'up' | 'down' | null>(null);

  private previous: Decimal | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });

    effect(() => {
      const current = this.value();
      const previous = this.previous;
      this.previous = current;
      // First render establishes a baseline; there is nothing to flash against.
      if (!previous) return;

      const direction = current.compareTo(previous);
      if (direction === 0) return;

      this.flash.set(direction > 0 ? 'up' : 'down');
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flash.set(null), FLASH_MS);
    });
  }
}
