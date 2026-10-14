import type { SentimentLabel } from '../../core/news/news';

export const MOOD_LABEL: Readonly<Record<SentimentLabel, string>> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

/** Shape as well as colour, so the label survives a colour-blind reader. */
export const MOOD_GLYPH: Readonly<Record<SentimentLabel, string>> = { positive: '▲', neutral: '■', negative: '▼' };

/** Suffix of the global .sent-* classes. */
export const MOOD_TONE: Readonly<Record<SentimentLabel, string>> = { positive: 'pos', neutral: 'neu', negative: 'neg' };

/** "just now", "12m ago", "3h ago", "2d ago". */
export function ago(at: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "Today", "Yesterday", or "Mon 12 Oct". */
export function dayLabel(at: Date): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
