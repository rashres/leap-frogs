import type { AnalyticsInterval } from '../../core/api/analytics.service';

const compactFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** "$737.4K" */
export function compactUsd(value: number): string {
  return compactFormat.format(value);
}

/** A yyyy-MM-dd date from the API as a local date (new Date("2026-07-01") would be UTC midnight). */
export function parseDay(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** A date as yyyy-MM-dd in local time. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "13 Oct", "Week of 6 Oct", "Oct 2026"; `short` for axis labels. */
export function periodLabel(period: string, interval: AnalyticsInterval, short: boolean): string {
  const date = parseDay(period);
  switch (interval) {
    case 'month':
      return date.toLocaleDateString('en-GB', { month: short ? 'short' : 'long', year: 'numeric' });
    case 'week': {
      const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return short ? day : `Week of ${day}`;
    }
    default:
      return date.toLocaleDateString('en-GB', short ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}

/** "13 Oct 2026" */
export function dayLabel(value: string): string {
  return parseDay(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Builds a CSV file and hands it to the browser as a download. */
type Cell = string | number | null;

export function downloadCsv(filename: string, headers: readonly Cell[], rows: readonly (readonly Cell[])[]): void {
  const escape = (value: Cell) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
