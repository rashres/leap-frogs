/**
 * Market news for the instruments this platform trades: a mood summary, the
 * main stocks as filters, top stories with pictures, then every headline by day.
 *
 * Sentiment is a count of matched words (see core/news/sentiment.ts). Each
 * headline can show the words it matched and why it was filed under a stock,
 * and stocks are ordered by how much was written about them, never by score.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import type { AttributedNewsItem, SentimentLabel } from '../../core/news/news';
import { NewsService } from '../../core/news/news.service';
import { SENTIMENT_DISCLAIMER, summarise } from '../../core/news/sentiment';
import { MarketStore } from '../../core/state/market.store';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { PageHeader } from '../../shared/page-header';
import { HeadlineRow } from './headline-row';
import { ago, dayLabel, MOOD_GLYPH, MOOD_LABEL, MOOD_TONE } from './news-format';

type Mood = 'all' | SentimentLabel;

/** One row of equal cards across the page. */
const TOP_STORIES = 4;
const PAGE = 30;

@Component({
  selector: 'leap-news-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Icon, InstrumentLogo, HeadlineRow],
  templateUrl: './news-page.html',
  styleUrl: './news-page.scss',
})
export class NewsPage {
  protected readonly news = inject(NewsService);
  protected readonly market = inject(MarketStore);

  readonly moods: readonly Mood[] = ['all', 'positive', 'neutral', 'negative'];
  readonly moodLabel: Record<Mood, string> = { all: 'All', ...MOOD_LABEL };
  readonly glyph = MOOD_GLYPH;
  readonly tone = MOOD_TONE;
  readonly disclaimer = SENTIMENT_DISCLAIMER;

  readonly selected = signal<number | null>(null);
  readonly mood = signal<Mood>('all');
  readonly query = signal('');
  readonly limit = signal(PAGE);
  /** Stories whose picture failed to load; they fall back to a logo tile. */
  readonly broken = signal<ReadonlySet<string>>(new Set());
  /** Ticks every minute so "updated 3m ago" and "2h ago" stay true. */
  private readonly now = signal(Date.now());

  readonly loading = computed(() => this.news.state() === 'loading');
  readonly all = computed(() => this.news.sweepHeadlines());
  readonly board = computed(() => this.news.board());

  /** The stock chips: covered stocks, most written-about first; silent ones last and dimmed. */
  readonly stocks = computed(() =>
    this.board().map((row) => {
      const c = row.counts;
      const pct = (n: number) => (c.total > 0 ? (n / c.total) * 100 : 0);
      return {
        id: row.instrumentId,
        symbol: row.symbol,
        name: row.name,
        total: c.total,
        pos: pct(c.positive),
        neu: pct(c.neutral),
        neg: pct(c.negative),
        title: c.total
          ? `${row.name}: ${c.total} headlines — ${c.positive} positive, ${c.neutral} neutral, ${c.negative} negative`
          : `${row.name}: no headlines in this window`,
      };
    }),
  );

  readonly selectedStock = computed(() => this.stocks().find((s) => s.id === this.selected()) ?? null);

  /** Headlines for the chosen stock and search, before the mood filter (so the mood bar shows the split). */
  private readonly scoped = computed(() => {
    const id = this.selected();
    const q = this.query().trim().toLowerCase();
    return this.all().filter(
      (item) =>
        (id == null || item.attributions.some((a) => a.instrumentId === id)) &&
        (!q || `${item.title} ${item.summary ?? ''} ${item.publisher}`.toLowerCase().includes(q)),
    );
  });

  readonly counts = computed(() => summarise(this.scoped()));

  readonly moodBar = computed(() => {
    const c = this.counts();
    const pct = (n: number) => (c.total > 0 ? (n / c.total) * 100 : 0);
    return { pos: pct(c.positive), neu: pct(c.neutral), neg: pct(c.negative) };
  });

  readonly filtered = computed(() => {
    const mood = this.mood();
    return mood === 'all' ? this.scoped() : this.scoped().filter((i) => i.sentiment.label === mood);
  });

  /** Newest stories with a working picture, as one row of equal cards; the rest follow as a list. */
  readonly topStories = computed(() => {
    if (this.query().trim()) return [];
    const items = this.filtered();
    if (items.length < 3) return [];
    const broken = this.broken();
    // Pictured stories first, topped up with others (shown with a logo tile) so the row is always full.
    const pictured = items.filter((i) => i.imageUrl && !broken.has(i.id));
    const chosen = new Set([...pictured, ...items].slice(0, TOP_STORIES));
    return items.filter((i) => chosen.has(i));
  });

  private readonly rest = computed(() => {
    const top = new Set(this.topStories().map((i) => i.id));
    return this.filtered().filter((i) => !top.has(i.id));
  });

  /** The list under the top stories, grouped into Today / Yesterday / dates. */
  readonly days = computed(() => {
    this.now();
    const groups: { label: string; items: AttributedNewsItem[] }[] = [];
    for (const item of this.rest().slice(0, this.limit())) {
      const label = dayLabel(item.publishedAt);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  });

  readonly hidden = computed(() => Math.max(0, this.rest().length - this.limit()));

  readonly stats = computed(() => {
    this.now();
    const all = this.all();
    const board = this.board();
    const top = board[0];
    const oldest = all[all.length - 1]?.publishedAt;
    const spanDays = oldest ? Math.max(1, Math.ceil((Date.now() - oldest.getTime()) / 86_400_000)) : 0;
    return {
      headlines: all.length,
      span: spanDays === 1 ? 'in the last day' : `over the last ${spanDays} days`,
      inNews: board.filter((r) => r.counts.total > 0).length,
      covered: board.length,
      topSymbol: top && top.counts.total > 0 ? top.symbol : null,
      topCount: top?.counts.total ?? 0,
      newest: all[0] ? ago(all[0].publishedAt) : '—',
    };
  });

  readonly sourceText = computed(() => {
    const source = this.news.servedBy();
    if (!source) return null;
    const name = source === 'newsapi' ? 'NewsAPI.org' : 'Yahoo Finance';
    this.now();
    const at = this.news.fetchedAt();
    return at ? `${name} · updated ${ago(at)}` : name;
  });

  constructor() {
    // The sweep query is built from the database instruments, so wait for them.
    let swept = false;
    effect(() => {
      if (swept || this.news.covered().length === 0) return;
      swept = true;
      untracked(() => void this.news.sweepMainStocks());
    });
    // Back to the first page of results whenever the filters change.
    effect(() => {
      this.selected();
      this.mood();
      this.query();
      untracked(() => this.limit.set(PAGE));
    });
    const tick = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }

  reload(): void {
    void this.news.sweepMainStocks(true);
  }

  pick(id: number | null): void {
    this.selected.set(this.selected() === id ? null : id);
  }

  clearFilters(): void {
    this.selected.set(null);
    this.mood.set('all');
    this.query.set('');
  }

  showMore(): void {
    this.limit.update((n) => n + PAGE);
  }

  markBroken(id: string): void {
    this.broken.update((set) => new Set(set).add(id));
  }

  ago(at: Date): string {
    this.now();
    return ago(at);
  }
}
