/**
 * Market news, scored and filed against the main stocks.
 *
 * The page answers one question — "what is being written about the instruments
 * this platform trades, and how is it worded" — and refuses to answer the
 * question a reader will want to ask next, which is whether that is a reason to
 * buy. Every number here is a count of headlines. None of them is a signal.
 *
 * The additional capability of section 4.1, proposed by the project author. It
 * has no US or BR behind it and is recorded as such in docs/traceability.md and
 * docs/open-questions.md OQ-11 and OQ-15.
 *
 * [4.1]
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NewsService } from '../../core/data/news.service';
import { NewsFeed } from '../../shared/news-feed';
import { StockSentimentBoard } from '../../shared/stock-sentiment-board';

@Component({
  selector: 'leap-news-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NewsFeed, StockSentimentBoard],
  template: `
    <div class="head">
      <div>
        <h1>News</h1>
        <p class="sub dim">
          Headlines about the instruments this platform trades, with a transparent sentiment read.
          Every score shows the words it matched and every stock shows why a headline was filed
          under it, because a number you cannot check is a number you should not trust.
        </p>
      </div>
      <span class="trace"><code>4.1</code></span>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Main stocks</h2>
        <div class="right">
          @if (news.servedBy(); as source) {
            <span class="pill pill-muted">via {{ sourceLabel(source) }}</span>
          }
          <button type="button" class="refresh" (click)="reload()" [disabled]="loading()">
            {{ loading() ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
      </div>

      @if (news.fellBackBecause(); as reason) {
        <p class="notice faint">
          Primary news source unavailable — {{ reason }} Showing the keyless fallback feed.
        </p>
      }

      @switch (news.state()) {
        @case ('loading') {
          <p class="empty">Sweeping headlines…</p>
        }
        @case ('unavailable') {
          <p class="empty">{{ news.error() }}</p>
        }
        @default {
          <leap-stock-sentiment-board
            [rows]="news.board()"
            [selected]="selected()"
            (pick)="selected.set($event)"
          />
          <p class="method faint">
            {{ swept() }} headlines filed by company name, from the most recent hundred published in
            the last seven days by a fixed list of financial publishers. "No headlines" means none
            in that window, which is not the same as nothing to report — the window is one request
            wide because the news plan allows a hundred a day. A stock with no headlines is shown as
            such rather than as neutral. Rows are ordered by how much was written, not by how
            positive it was: an ordering by score would be a ranking of instruments, which this is
            not.
          </p>
        }
      }
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">
          {{ selectedSymbol() ? selectedSymbol() + ' headlines' : 'All headlines' }}
        </h2>
        @if (selected()) {
          <button type="button" class="refresh" (click)="selected.set(null)">Show all</button>
        }
      </div>
      <leap-news-feed [items]="visible()" [state]="news.state()" [error]="news.error()" />
    </div>
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }
      h1 {
        margin: 0;
        font-size: 27px;
        font-weight: 700;
        letter-spacing: -0.018em;
      }
      .sub {
        margin: 5px 0 0;
        font-size: 13px;
        max-width: 68ch;
      }
      .panel + .panel {
        margin-top: 16px;
      }
      .right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .refresh {
        font-size: 11.5px;
        font-weight: 620;
        color: var(--accent);
        padding: 4px 9px;
        border-radius: var(--radius-sm);

        &:hover:not(:disabled) {
          background: var(--accent-soft);
        }
        &:disabled {
          color: var(--text-3);
          cursor: default;
        }
      }
      .notice,
      .method {
        margin: 0;
        padding: 10px 16px;
        font-size: 11px;
        line-height: 1.5;
        border-top: 1px solid var(--border-soft);
      }
      .notice {
        border-top: 0;
        border-bottom: 1px solid var(--border-soft);
      }
      .empty {
        margin: 0;
        padding: 22px 16px;
        font-size: 12px;
        color: var(--text-3);
      }
    `,
  ],
})
export class NewsPage {
  protected readonly news = inject(NewsService);

  readonly selected = signal<string | null>(null);

  readonly loading = computed(() => this.news.state() === 'loading');

  readonly swept = computed(() => this.news.sweepHeadlines().length);

  readonly selectedSymbol = computed(
    () => this.news.board().find((row) => row.instrumentId === this.selected())?.symbol ?? null,
  );

  /** The feed below the board: everything, or one stock's headlines. */
  readonly visible = computed(() => {
    const id = this.selected();
    const items = this.news.sweepHeadlines();
    return id ? items.filter((i) => i.attributions.some((a) => a.instrumentId === id)) : items;
  });

  constructor() {
    void this.news.sweepMainStocks();
  }

  reload(): void {
    void this.news.sweepMainStocks(true);
  }

  sourceLabel(source: 'newsapi' | 'yahoo'): string {
    return source === 'newsapi' ? 'NewsAPI.org' : 'Yahoo Finance';
  }
}
