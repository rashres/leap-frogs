import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ApiError } from '../core/api/api-error';

/**
 * Loading / error / empty wrapper for any API-backed block. Projects its
 * content only when there is data to show.
 */
@Component({
  selector: 'leap-async-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="skeleton" aria-busy="true" aria-label="Loading">
        @for (row of rows; track row) {
          <span class="bar" [style.width.%]="row"></span>
        }
      </div>
    } @else if (error(); as e) {
      <div class="message error" role="alert">
        <div class="title">{{ e.unreachable ? 'API unreachable' : e.status + ' · ' + e.title }}</div>
        <div class="detail">{{ e.message }}</div>
        <button type="button" class="btn btn-sm" (click)="retry.emit()">Try again</button>
      </div>
    } @else if (empty()) {
      <div class="message">
        <div class="detail">{{ emptyText() }}</div>
        <ng-content select="[empty]" />
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: [
    `
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px 18px;
      }
      .bar {
        height: 12px;
        border-radius: 6px;
        background: linear-gradient(90deg, var(--panel-2), var(--panel-3), var(--panel-2));
        background-size: 200% 100%;
        animation: shimmer 1.3s ease-in-out infinite;
      }
      @keyframes shimmer {
        from {
          background-position: 100% 0;
        }
        to {
          background-position: -100% 0;
        }
      }
      .message {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 36px 20px;
        text-align: center;
        color: var(--text-3);
        font-size: 13px;
      }
      .error .title {
        color: var(--down);
        font-weight: 700;
        font-size: 13.5px;
      }
      .error .detail {
        color: var(--text-2);
        max-width: 520px;
      }
      .error .btn {
        margin-top: 6px;
      }
    `,
  ],
})
export class AsyncState {
  readonly loading = input(false);
  readonly error = input<ApiError | undefined | null>();
  readonly empty = input(false);
  readonly emptyText = input('Nothing here yet.');

  readonly retry = output<void>();

  protected readonly rows = [92, 78, 85, 64];
}
