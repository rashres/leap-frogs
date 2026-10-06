import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiStatusService } from '../core/state/api-status.service';

const VIEW = {
  checking: { label: 'Checking', tone: 'muted', title: 'Checking API health…' },
  up: { label: 'API online', tone: 'good', title: 'API and database are up. Click to re-check.' },
  'db-down': { label: 'DB down', tone: 'warn', title: 'API is running but the database is unreachable. Click to re-check.' },
  unreachable: { label: 'API offline', tone: 'bad', title: 'Cannot reach the API on port 8081. Click to re-check.' },
} as const;

@Component({
  selector: 'leap-api-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="'badge ' + view().tone" [attr.title]="view().title" (click)="status.check()">
      <i class="dot" aria-hidden="true"></i>{{ view().label }}
    </button>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 28px;
        padding: 0 11px;
        border-radius: 999px;
        border: 1px solid var(--border-soft);
        font-size: 11.5px;
        font-weight: 650;
        letter-spacing: 0.02em;
        color: var(--text-2);
        white-space: nowrap;
      }
      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--text-3);
      }
      .good {
        color: var(--up);
        background: var(--up-soft);
        border-color: rgba(0, 200, 5, 0.25);
      }
      .good .dot {
        background: var(--up);
        box-shadow: 0 0 7px rgba(0, 200, 5, 0.75);
      }
      .warn {
        color: var(--warn);
        background: var(--warn-soft);
      }
      .warn .dot {
        background: var(--warn);
      }
      .bad {
        color: var(--down);
        background: var(--down-soft);
      }
      .bad .dot {
        background: var(--down);
      }
    `,
  ],
})
export class ApiStatusBadge {
  protected readonly status = inject(ApiStatusService);
  protected readonly view = computed(() => VIEW[this.status.status()]);
}
