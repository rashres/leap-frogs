import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService, LANGUAGES } from '../core/i18n/i18n.service';
import { SHELL_TEXT } from '../core/i18n/shell.i18n';
import { DisplayService, type TextSize } from '../core/state/display.service';
import { Icon } from './icon';

/**
 * Top-bar language picker and Display panel (text size, high contrast).
 * Both choices are saved in the browser and apply to every page.
 */
@Component({
  selector: 'leap-display-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:keydown.escape)': 'displayOpen.set(false)' },
  template: `
    <label class="lang">
      <span class="sr-only">{{ t().language }}</span>
      <leap-icon name="globe" [size]="16" />
      <select class="lang-select" [value]="i18n.lang()" (change)="setLang($event)" [attr.title]="t().language">
        @for (l of languages; track l.code) {
          <option [value]="l.code" [attr.lang]="l.code" [selected]="l.code === i18n.lang()">{{ l.name }}</option>
        }
      </select>
    </label>

    <div class="display">
      <button
        type="button"
        class="icon-btn display-btn"
        [class.open]="displayOpen()"
        (click)="displayOpen.set(!displayOpen())"
        [attr.aria-expanded]="displayOpen()"
        aria-controls="display-panel"
        [attr.aria-label]="t().display"
        [attr.title]="t().display"
      >
        <span class="aa" aria-hidden="true">Aa</span>
      </button>
      @if (displayOpen()) {
        <div class="menu-backdrop" (click)="displayOpen.set(false)"></div>
        <div class="menu display-panel" id="display-panel" role="dialog" [attr.aria-label]="t().displaySettings">
          <fieldset class="dp-group">
            <legend class="menu-head">{{ t().textSize }}</legend>
            <div class="segmented dp-sizes">
              @for (size of textSizes; track size) {
                <button
                  type="button"
                  [class.on]="display.textSize() === size"
                  [attr.aria-pressed]="display.textSize() === size"
                  (click)="display.setTextSize(size)"
                >
                  {{ t().sizes[size] }}
                </button>
              }
            </div>
          </fieldset>
          <label class="dp-contrast">
            <input type="checkbox" [checked]="display.contrast()" (change)="display.setContrast($any($event.target).checked)" />
            <span>
              <span class="dp-label">{{ t().contrast }}</span>
              <span class="dp-hint">{{ t().contrastHint }}</span>
            </span>
          </label>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 49;
      }

      .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 10px);
        z-index: 50;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lift);
      }

      .menu-head {
        margin: 6px 10px 8px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-3);
      }

      @media (max-width: 640px) {
        .lang leap-icon {
          display: none;
        }
      }

      .lang {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 36px;
        padding: 0 4px 0 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--panel);
        color: var(--text-2);

        &:focus-within {
          box-shadow: var(--focus-ring);
          border-color: var(--accent);
        }
      }

      .lang-select {
        height: 34px;
        padding: 0 4px;
        border: none;
        background: transparent;
        color: var(--text);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
      }

      .display {
        position: relative;
      }

      .aa {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .display-btn.open {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .display-panel {
        width: min(300px, calc(100vw - 24px));
        padding: 10px;
      }

      .dp-group {
        margin: 0;
        padding: 0;
        border: none;

        .menu-head {
          padding: 0;
        }
      }

      .dp-sizes {
        display: flex;
        margin: 0 6px 8px;

        button {
          flex: 1;
        }
      }

      .dp-contrast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin: 6px 6px 2px;
        padding: 10px 0 2px;
        border-top: 1px solid var(--border-soft);
        cursor: pointer;

        input {
          width: 16px;
          height: 16px;
          margin-top: 2px;
          accent-color: var(--accent);
        }
      }

      .dp-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }

      .dp-hint {
        display: block;
        font-size: 12px;
        color: var(--text-3);
      }
    `,
  ],
})
export class DisplayControls {
  protected readonly i18n = inject(I18nService);
  protected readonly display = inject(DisplayService);

  protected readonly t = computed(() => SHELL_TEXT[this.i18n.lang()]);
  protected readonly languages = LANGUAGES;
  protected readonly textSizes: readonly TextSize[] = ['default', 'large', 'larger'];
  protected readonly displayOpen = signal(false);

  setLang(event: Event): void {
    this.i18n.set((event.target as HTMLSelectElement).value);
  }
}
