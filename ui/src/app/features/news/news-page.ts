/**
 * Market news, scored and filed against the equities in the database. Every
 * number here is a count of headlines; none of them is a signal. Adapted from
 * fe/21-page-mascots (features/news).
 */

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NewsService } from '../../core/news/news.service';
import { MarketStore } from '../../core/state/market.store';
import { NewsFeed } from '../../shared/news-feed';
import { StockSentimentBoard } from '../../shared/stock-sentiment-board';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'leap-news-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NewsFeed, StockSentimentBoard, PageHeader, Icon],
  template: `
    <div class="page-enter">
      <leap-page-header heading="News" mascot="news">
        <span description>
          Headlines about the instruments this platform trades, with a transparent sentiment read. Every score shows the
          words it matched and every stock shows why a headline was filed under it, because a number you cannot check is
          a number you should not trust.
        </span>
      </leap-page-header>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Main stocks</h2>
            <p class="panel-sub">Headline counts per company, by wording</p>
          </div>
          <div class="right">
            @if (news.servedBy(); as source) {
              <span class="pill pill-muted">via {{ sourceLabel(source) }}</span>
            }
            <button type="button" class="btn btn-secondary btn-sm" (click)="reload()" [disabled]="loading()">
              <leap-icon name="refresh" [size]="16" [class.spin]="loading()" />
              {{ loading() ? 'Loading…' : 'Refresh' }}
            </button>
          </div>
        </div>

        @if (news.fellBackBecause(); as reason) {
          <p class="notice">
            <leap-icon name="alert" [size]="16" />
            <span>Primary news source unavailable — {{ reason }} Showing the keyless fallback feed.</span>
          </p>
        }

        @if (market.loaded() && news.covered().length === 0) {
          <p class="empty">No equities in the database to file headlines under.</p>
        } @else {
          @switch (news.state()) {
            @case ('loading') {
              <div class="sk" aria-hidden="true">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <div class="sk-row">
                    <span class="skeleton" style="width: 90px"></span>
                    <span class="skeleton" style="width: 40px; margin-left: auto"></span>
                    <span class="skeleton" style="width: 30%"></span>
                  </div>
                }
              </div>
              <p class="sr-only" role="status">Sweeping headlines…</p>
            }
            @case ('unavailable') {
              <div class="pad"><p class="state-error">{{ news.error() }}</p></div>
            }
            @default {
              <leap-stock-sentiment-board [rows]="news.board()" [selected]="selected()" (pick)="selected.set($event)" />
              <p class="method faint">
                {{ swept() }} headlines filed by company name, from the most recent hundred published in the last seven
                days by a fixed list of financial publishers. "No headlines" means none in that window, which is not the
                same as nothing to report — the window is one request wide because the news plan allows a hundred a day.
                A stock with no headlines is shown as such rather than as neutral. Rows are ordered by how much was
                written, not by how positive it was: an ordering by score would be a ranking of instruments, which this
                is not.
              </p>
            }
          }
        }
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">
              {{ selectedSymbol() ? selectedSymbol() + ' headlines' : 'All headlines' }}
            </h2>
            <p class="panel-sub">Pick a stock above to narrow the list</p>
          </div>
          @if (selected()) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="selected.set(null)">
              <leap-icon name="x" [size]="16" />Show all
            </button>
          }
        </div>
        <leap-news-feed [items]="visible()" [state]="news.state()" [error]="news.error()" />
      </section>
    </div>
  `,
  styles: [
    `
      .panel + .panel {
        margin-top: 24px;
      }
      .right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      .spin {
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .notice {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 0;
        padding: 12px 22px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--warn);
        background: var(--warn-soft);
        border-bottom: 1px solid var(--warn-line);
      }
      .notice leap-icon {
        margin-top: 2px;
      }
      .method {
        margin: 0;
        padding: 14px 22px 16px;
        font-size: 12.5px;
        line-height: 1.6;
        border-top: 1px solid var(--border-soft);
        background: var(--panel-2);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      }
      .pad {
        padding: 18px 22px;
      }
      .sk {
        padding: 10px 22px;
      }
      .sk-row {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 12px 0;
      }
      .sk-row + .sk-row {
        border-top: 1px solid var(--border-soft);
      }
    `,
  ],
})
export class NewsPage {
  protected readonly news = inject(NewsService);
  protected readonly market = inject(MarketStore);

  readonly selected = signal<number | null>(null);

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
    // The sweep query is built from the database instruments, so wait for them.
    let swept = false;
    effect(() => {
      if (swept || this.news.covered().length === 0) return;
      swept = true;
      untracked(() => void this.news.sweepMainStocks());
    });
  }

  reload(): void {
    void this.news.sweepMainStocks(true);
  }

  sourceLabel(source: 'newsapi' | 'yahoo'): string {
    return source === 'newsapi' ? 'NewsAPI.org' : 'Yahoo Finance';
  }
}
