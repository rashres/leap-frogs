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

/** "+$1,234.50" / "−$12.00", with a true minus sign. */
export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return `${value < 0 ? '−' : '+'}${usdFormat.format(Math.abs(value))}`;
}

/** "+3.21%" / "−0.50%". */
export function formatSignedPct(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}%`;
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-GB');
}

/** "05 Oct, 14:03:22", the timestamp style used on the orders screen. */
export function formatStamp(value: string | number | Date | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
