import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/** Right-hand slide-over panel. Closes on Escape, backdrop click, or the close button. */
@Component({
  selector: 'leap-side-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <aside class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="title()" tabindex="-1" #panel>
        <header class="sheet-head">
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" (click)="closed.emit()" aria-label="Close">✕</button>
        </header>
        <div class="sheet-body">
          <ng-content />
        </div>
      </aside>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        background: rgba(0, 0, 0, 0.6);
        animation: fade 0.15s ease-out;
      }
      .sheet {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 51;
        width: min(460px, 100vw);
        display: flex;
        flex-direction: column;
        background: var(--panel);
        border-left: 1px solid var(--border);
        outline: none;
        animation: slide 0.18s ease-out;
      }
      .sheet-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-soft);
      }
      h2 {
        font-size: 16px;
        font-weight: 700;
      }
      .sheet-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes slide {
        from {
          transform: translateX(24px);
          opacity: 0;
        }
      }
    `,
  ],
})
export class SideSheet {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Move focus into the sheet when it opens so keyboard users land inside it.
    effect(() => this.panel()?.nativeElement.focus());
  }
}
