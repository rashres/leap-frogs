import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { formatUsd } from './format';

const FLASH_MS = 480;

/**
 * A price that flashes when it changes, so a refreshed lastPrice is visible.
 * Adapted from the team's Angular app (fe/21-page-mascots, shared/live-price.ts).
 */
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
        transition:
          background-color 0.4s ease,
          box-shadow 0.4s ease;
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
  readonly value = input.required<number | null>();

  readonly text = computed(() => formatUsd(this.value()));
  readonly flash = signal<'up' | 'down' | null>(null);

  private previous: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });

    effect(() => {
      const current = this.value();
      const previous = this.previous;
      this.previous = current;
      if (current == null || previous == null || current === previous) return;
      this.flash.set(current > previous ? 'up' : 'down');
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flash.set(null), FLASH_MS);
    });
  }
}
