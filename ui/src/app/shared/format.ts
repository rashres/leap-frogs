import { Pipe, PipeTransform } from '@angular/core';
import { currentLocale } from '../core/i18n/i18n.service';

/** Intl formatters are costly to build, so keep one per locale and style. */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = currentLocale();
  const id = `n:${locale}:${key}`;
  let f = cache.get(id) as Intl.NumberFormat | undefined;
  if (!f) cache.set(id, (f = new Intl.NumberFormat(locale, options)));
  return f;
}

function dateFormat(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = currentLocale();
  const id = `d:${locale}:${key}`;
  let f = cache.get(id) as Intl.DateTimeFormat | undefined;
  if (!f) cache.set(id, (f = new Intl.DateTimeFormat(locale, options)));
  return f;
}

/** The platform settles in US dollars only. Formatting follows the chosen language. */
const usd = () => numberFormat('usd', { style: 'currency', currency: 'USD' });

/** Quantities are NUMERIC(18,6): show up to 6 decimals, trimmed. */
const qty = () => numberFormat('qty', { maximumFractionDigits: 6 });

export function formatUsd(value: number | null | undefined): string {
  return value == null ? '—' : usd().format(value);
}

const smallPrice = () =>
  numberFormat('small', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });

/**
 * A unit price: four decimals below $10 (FX pairs, penny stocks), otherwise cents.
 * Pass `reference` to format a price change at the precision of the price it changed from.
 */
export function formatPrice(value: number | null | undefined, reference: number | null = value ?? null): string {
  if (value == null) {
    return '—';
  }
  return Math.abs(reference ?? value) < 10 ? smallPrice().format(value) : usd().format(value);
}

/** "+$1,234.50" / "−$12.00", with a true minus sign. */
export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return `${value < 0 ? '−' : '+'}${usd().format(Math.abs(value))}`;
}

/** "+3.21%" / "−0.50%". */
export function formatSignedPct(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const pct = numberFormat('pct', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
  return `${value < 0 ? '−' : '+'}${pct}%`;
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : dateFormat('time', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
}

/** "05 Oct, 14:03:22", the timestamp style used on the orders screen. */
export function formatStamp(value: string | number | Date | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : dateFormat('stamp', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
}

export function formatQty(value: number | null | undefined): string {
  return value == null ? '—' : qty().format(value);
}

export function formatDateTime(value: string | number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : dateFormat('dateTime', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}

@Pipe({ name: 'usd', pure: false })
export class UsdPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatUsd(value);
  }
}

@Pipe({ name: 'qty', pure: false })
export class QtyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatQty(value);
  }
}

@Pipe({ name: 'dateTime', pure: false })
export class DateTimePipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return formatDateTime(value);
  }
}
