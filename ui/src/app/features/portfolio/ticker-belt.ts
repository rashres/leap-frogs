import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatPrice, formatSignedPct } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { DayChangeStore } from './day-change.store';

/**
 * Continuously scrolling strip of every instrument's live price and 24-hour
 * change. The list is rendered twice so the loop is seamless; the copy is
 * hidden from assistive tech and the tab order.
 */
@Component({
  selector: 'leap-ticker-belt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo],
  template: `
    @if (items().length) {
      <div class="belt" role="region" aria-label="Live prices">
        <div class="track" [style.animation-duration.s]="items().length * 4">
          @for (copy of [0, 1]; track copy) {
            <ul class="run" [attr.aria-hidden]="copy === 1 ? 'true' : null">
              @for (item of items(); track item.id) {
                <li>
                  <a [routerLink]="['/instrument', item.id]" [attr.tabindex]="copy === 1 ? -1 : null">
                    <leap-instrument-logo [symbol]="item.symbol" [size]="22" />
                    <span class="sym">{{ item.symbol }}</span>
                    <span class="price num">{{ item.price }}</span>
                    @if (item.pct; as pct) {
                      <span class="chg num" [class.up]="!item.negative" [class.down]="item.negative">{{ pct }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .belt {
        position: relative;
        overflow: hidden;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
        mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent);
      }
      .track {
        display: flex;
        width: max-content;
        animation: belt linear infinite;
      }
      .belt:hover .track,
      .belt:focus-within .track {
        animation-play-state: paused;
      }
      @keyframes belt {
        to {
          transform: translateX(-50%);
        }
      }
      .run {
        display: flex;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      a {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 50px;
        padding: 0 22px;
        white-space: nowrap;
        font-size: 13.5px;
        border-right: 1px solid var(--border-soft);
        transition: background-color 0.15s ease;
      }
      a:hover {
        background: var(--panel-hover);
      }
      .sym {
        font-weight: 600;
      }
      .price {
        color: var(--text-2);
      }
      .chg {
        font-weight: 600;
        font-size: 12.5px;
      }
      @media (prefers-reduced-motion: reduce) {
        .belt {
          overflow-x: auto;
          mask-image: none;
        }
        .track {
          animation: none;
        }
        .run[aria-hidden='true'] {
          display: none;
        }
      }
    `,
  ],
})
export class TickerBelt {
  private readonly store = inject(DayChangeStore);

  readonly items = computed(() =>
    this.store
      .rows()
      .filter((r) => r.price != null)
      .map((r) => ({
        id: r.id,
        symbol: r.symbol,
        price: formatPrice(r.price),
        pct: r.changePct != null ? formatSignedPct(r.changePct) : null,
        negative: (r.change ?? 0) < 0,
      })),
  );
}
