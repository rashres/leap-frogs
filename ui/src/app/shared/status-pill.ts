import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OrderStatus } from '../core/api/models';

const LABELS: Record<OrderStatus, { label: string; tone: string }> = {
  COMPLETE: { label: 'Completed', tone: 'pill-good' },
  FAILED: { label: 'Rejected', tone: 'pill-bad' },
  PENDING: { label: 'Pending', tone: 'pill-accent' },
  CREATED: { label: 'Created', tone: 'pill-muted' },
};

@Component({
  selector: 'leap-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'pill ' + view().tone" [attr.title]="status()">{{ view().label }}</span>`,
})
export class StatusPill {
  readonly status = input.required<OrderStatus>();

  readonly view = computed(() => LABELS[this.status()] ?? { label: this.status(), tone: 'pill-muted' });
}
