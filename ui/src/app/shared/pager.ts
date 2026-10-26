import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { tk } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';
import { Icon } from './icon';

/**
 * Page numbers under a client-side list: "1–20 of 64", previous/next, and up to
 * five page buttons around the current one. Hidden when everything fits on one page.
 * `page` is zero-based; the parent keeps it and slices its own rows.
 */
@Component({
  selector: 'leap-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, Icon],
  template: `
    @if (pages() > 1) {
      <nav class="pager" [attr.aria-label]="label() | t">
        <span class="range num">{{ '{from}–{to} of {n}' | t: { from: first() + 1, to: last(), n: count() } }}</span>
        <div class="buttons">
          <button type="button" class="page-button page-arrow" [disabled]="page() === 0" (click)="go(page() - 1)">
            <leap-icon name="chevron-left" [size]="16" /><span class="sr-only">{{ 'Previous page' | t }}</span>
          </button>
          @for (n of buttons(); track n) {
            <button
              type="button"
              class="page-button"
              [class.current]="n === page()"
              [attr.aria-current]="n === page() ? 'page' : null"
              (click)="go(n)"
            >
              {{ n + 1 }}
            </button>
          }
          <button type="button" class="page-button page-arrow" [disabled]="page() >= pages() - 1" (click)="go(page() + 1)">
            <leap-icon name="chevron-right" [size]="16" /><span class="sr-only">{{ 'Next page' | t }}</span>
          </button>
        </div>
      </nav>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 12px 16px;
        border-top: 1px solid var(--border-soft);
      }
      .range {
        font-size: 12.5px;
        color: var(--text-3);
      }
      .buttons {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .page-button {
        display: inline-grid;
        place-items: center;
        min-width: 32px;
        height: 32px;
        padding: 0 8px;
        border: 1px solid transparent;
        border-radius: var(--radius);
        color: var(--text-2);
        font-size: 13px;
      }
      .page-button:hover:not(:disabled) {
        background: var(--panel-3);
        color: var(--text);
      }
      .page-button:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
      }
      .page-button:disabled {
        opacity: 0.4;
      }
      .page-button.current {
        background: var(--accent);
        color: var(--on-accent);
        font-weight: 700;
      }
      .page-arrow {
        border-color: var(--border);
      }
    `,
  ],
})
export class Pager {
  readonly page = input.required<number>();
  /** How many rows there are in all. */
  readonly count = input.required<number>();
  /** Rows per page. */
  readonly size = input.required<number>();
  /** Accessible name for the page list, in English (translated here). */
  readonly label = input<string>(tk('Pages'));
  readonly pageChange = output<number>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.count() / this.size())));
  readonly first = computed(() => this.page() * this.size());
  readonly last = computed(() => Math.min(this.count(), this.first() + this.size()));
  readonly buttons = computed(() => {
    const total = this.pages();
    const start = Math.max(0, Math.min(this.page() - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });

  go(page: number): void {
    if (page >= 0 && page < this.pages() && page !== this.page()) this.pageChange.emit(page);
  }
}

/** Rows on one zero-based page. */
export function pageOf<T>(rows: readonly T[], page: number, size: number): T[] {
  return rows.slice(page * size, page * size + size);
}
