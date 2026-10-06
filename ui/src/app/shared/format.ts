import { Pipe, PipeTransform } from '@angular/core';

/** The platform settles in US dollars only. */
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Quantities are NUMERIC(18,6): show up to 6 decimals, trimmed. */
const qtyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatUsd(value: number | null | undefined): string {
  return value == null ? '—' : usdFormat.format(value);
}

export function formatQty(value: number | null | undefined): string {
  return value == null ? '—' : qtyFormat.format(value);
}

export function formatDateTime(value: string | number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date);
}

@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatUsd(value);
  }
}

@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatQty(value);
  }
}

@Pipe({ name: 'dateTime' })
export class DateTimePipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return formatDateTime(value);
  }
}
