import type { OrderStatus } from '../core/api/models';
import { tk } from '../core/i18n/i18n.service';

/** Order states as the API stores them, labelled the way the fe/21 screens show them. English; show with `| t`. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  CREATED: tk('Submitted'),
  PENDING: tk('Pending'),
  COMPLETE: tk('Filled'),
  FAILED: tk('Rejected'),
  CANCELLED: tk('Cancelled'),
  EXPIRED: tk('Expired'),
};

/** Glyphs keep each status readable without relying on colour. */
export const ORDER_STATUS_GLYPH: Readonly<Record<OrderStatus, string>> = {
  CREATED: '◷',
  PENDING: '◷',
  COMPLETE: '✓',
  FAILED: '✕',
  CANCELLED: '–',
  EXPIRED: '⌛',
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
