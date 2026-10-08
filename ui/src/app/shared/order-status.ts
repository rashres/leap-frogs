import type { OrderStatus } from '../core/api/models';

/** Order states as the API stores them, labelled the way the fe/21 screens show them. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  CREATED: 'Submitted',
  PENDING: 'Working',
  COMPLETE: 'Filled',
  FAILED: 'Rejected',
};

/** Pill tone class suffix: pill-up, pill-down, pill-accent, pill-muted. */
export function statusTone(status: OrderStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'up';
    case 'FAILED':
      return 'down';
    case 'PENDING':
      return 'accent';
    default:
      return 'muted';
  }
}
