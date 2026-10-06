import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/state/toast.service';

@Component({
  selector: 'leap-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="outlet" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div [class]="'toast ' + toast.tone" role="status">
          <div class="body">
            <div class="title">{{ toast.title }}</div>
            @if (toast.message) {
              <div class="message">{{ toast.message }}</div>
            }
          </div>
          <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .outlet {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 60;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(360px, calc(100vw - 40px));
      }
      .toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: var(--radius);
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-left: 3px solid var(--accent);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
        animation: enter 0.18s ease-out;
      }
      .toast.success {
        border-left-color: var(--up);
      }
      .toast.error {
        border-left-color: var(--down);
      }
      .body {
        flex: 1;
        min-width: 0;
      }
      .title {
        font-weight: 680;
        font-size: 13.5px;
      }
      .message {
        margin-top: 2px;
        font-size: 12.5px;
        color: var(--text-2);
        overflow-wrap: anywhere;
      }
      .close {
        font-size: 18px;
        line-height: 1;
        color: var(--text-3);
        padding: 0 2px;
      }
      .close:hover {
        color: var(--text);
      }
      @keyframes enter {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
    `,
  ],
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
