import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsService } from '../../core/news/news.service';
import { Icon } from '../../shared/icon';

const SHOWN = 3;

/** The newest headlines from the News page's sweep; shares its 15-minute cache. */
@Component({
  selector: 'leap-market-news',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <section class="card">
      <div class="head">
        <h2 class="title">Market News</h2>
        <a class="btn btn-secondary btn-sm" routerLink="/news">View All</a>
      </div>

      @if (items().length > 0) {
        <ul class="list">
          @for (item of items(); track item.id) {
            <li>
              <a [href]="item.link" target="_blank" rel="noopener noreferrer">
                <span class="thumb">
                  @if (item.imageUrl && !broken().has(item.id)) {
                    <img [src]="item.imageUrl" alt="" loading="lazy" referrerpolicy="no-referrer" (error)="markBroken(item.id)" />
                  } @else {
                    <leap-icon name="news" [size]="22" [stroke]="1.5" />
                  }
                </span>
                <span class="body">
                  <span class="headline">{{ item.title }}</span>
                  @if (item.summary) {
                    <span class="desc">{{ item.summary }}</span>
                  }
                  <span class="meta">{{ item.publisher }} · {{ ago(item.publishedAt) }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      } @else if (news.state() === 'unavailable') {
        <p class="none">{{ news.error() ?? 'Headlines are unavailable right now.' }}</p>
      } @else if (news.state() === 'ready') {
        <p class="none">No recent headlines for the instruments on this platform.</p>
      } @else {
        <div class="loading" aria-hidden="true">
          @for (n of [1, 2, 3]; track n) {
            <div class="sk">
              <span class="skeleton sk-thumb"></span>
              <span class="sk-lines">
                <span class="skeleton" style="width: 80%"></span>
                <span class="skeleton" style="width: 60%"></span>
              </span>
            </div>
          }
        </div>
        <p class="sr-only" role="status">Loading headlines…</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        height: 100%;
        padding: 20px 24px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.005em;
      }
      .list {
        display: grid;
        gap: 14px;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .list a {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        border-radius: var(--radius);
      }
      .list a:hover .headline {
        color: var(--accent);
      }
      .thumb {
        display: grid;
        place-items: center;
        width: 88px;
        height: 88px;
        overflow: hidden;
        border-radius: 10px;
        background: var(--panel-3);
        color: var(--text-3);
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding-top: 2px;
      }
      .headline {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.35;
        color: var(--text);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        transition: color 0.12s ease;
      }
      .desc {
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--text-3);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .meta {
        font-size: 12px;
        color: var(--text-3);
      }
      .none {
        margin: 0;
        padding: 8px 0 12px;
        font-size: 13px;
        color: var(--text-3);
      }
      .loading {
        display: grid;
        gap: 14px;
      }
      .sk {
        display: flex;
        gap: 14px;
      }
      .sk-thumb {
        width: 88px;
        height: 88px;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .sk-lines {
        flex: 1;
        display: grid;
        gap: 8px;
        align-content: start;
        padding-top: 4px;
      }
      .sk-lines .skeleton {
        height: 12px;
      }
      @media (max-width: 560px) {
        .card {
          padding: 16px;
        }
        .list a {
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 12px;
        }
        .thumb,
        .sk-thumb {
          width: 72px;
          height: 72px;
        }
      }
    `,
  ],
})
export class MarketNews {
  protected readonly news = inject(NewsService);
  readonly broken = signal<ReadonlySet<string>>(new Set());

  readonly items = computed(() => this.news.sweepHeadlines().slice(0, SHOWN));

  constructor() {
    // The sweep query is built from the database instruments, so wait for them.
    let swept = false;
    effect(() => {
      if (swept || this.news.covered().length === 0) return;
      swept = true;
      untracked(() => void this.news.sweepMainStocks());
    });
  }

  markBroken(id: string): void {
    this.broken.update((set) => new Set(set).add(id));
  }

  ago(at: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}
