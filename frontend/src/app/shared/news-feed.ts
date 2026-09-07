/**
 * Headline list with per-item sentiment.
 *
 * The matched words are rendered next to every score on purpose. A score you
 * cannot interrogate is a score you have to take on trust, and this one has not
 * earned that — see sentiment.ts. Showing the words turns it from an assertion
 * into something a reader can check in a second and dismiss if it is wrong.
 *
 * [4.1]
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type {
  Attribution,
  AttributedNewsItem,
  ScoredNewsItem,
  SentimentLabel,
} from '../core/domain/news';
import { SENTIMENT_DISCLAIMER, summarise } from '../core/data/sentiment';
import type { FeedState } from '../core/data/news.service';

@Component({
  selector: 'leap-news-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = summary();

    @if (items().length > 0) {
      <div class="bar">
        <div class="counts">
          <span class="pill pill-good">{{ s.positive }} positive</span>
          <span class="pill pill-muted">{{ s.neutral }} neutral</span>
          <span class="pill pill-bad">{{ s.negative }} negative</span>
        </div>
        <span class="of faint">of {{ s.total }} headlines</span>
      </div>
    }

    @switch (state()) {
      @case ('loading') {
        <p class="empty">Loading headlines…</p>
      }
      @case ('unavailable') {
        <div class="unavailable">
          <p class="head">Headlines unavailable</p>
          <p class="faint">{{ error() ?? 'The news feed could not be reached.' }}</p>
          <p class="faint small">
            Live news is proxied through the dev server, so it needs
            <code>npm start</code> rather than a static build. No placeholder headlines are shown
            here on purpose — invented news is the one kind of filler a reader might act on.
          </p>
        </div>
      }
      @default {
        @if (items().length === 0) {
          <p class="empty">No headlines for this instrument.</p>
        } @else {
          <ul>
            @for (item of items(); track item.id) {
              <li>
                <div class="row">
                  <span class="pill" [class]="'pill-' + tone(item.sentiment.label)">
                    {{ label(item.sentiment.label) }}
                  </span>
                  <a class="title" [href]="item.link" target="_blank" rel="noopener noreferrer">
                    {{ item.title }}
                  </a>
                </div>
                <div class="meta faint">
                  <span>{{ item.publisher }}</span>
                  @for (a of filedUnder(item); track a.instrumentId) {
                    <span class="dot">·</span>
                    <span class="filed" [attr.title]="why(a)">{{ a.symbol }}</span>
                  }
                  <span class="dot">·</span>
                  <span>{{ ago(item.publishedAt) }}</span>
                  @if (item.sentiment.matched.length > 0) {
                    <span class="dot">·</span>
                    <span class="terms">
                      matched
                      @for (m of item.sentiment.matched; track $index) {
                        <code
                          class="term"
                          [class.pos]="m.polarity === 'positive'"
                          [class.neg]="m.polarity === 'negative'"
                          [attr.title]="m.negated ? 'Flipped by a preceding negation' : null"
                          >{{ m.term }}{{ m.negated ? ' (negated)' : '' }}</code
                        >
                      }
                    </span>
                  }
                </div>
              </li>
            }
          </ul>
          <p class="disclaimer faint">{{ disclaimer }}</p>
        }
      }
    }
  `,
  styles: [
    `
      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 16px;
        border-bottom: 1px solid var(--border-soft);
      }
      .counts {
        display: flex;
        gap: 6px;
      }
      .of {
        font-size: 11px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        padding: 12px 16px;
      }
      li + li {
        border-top: 1px solid var(--border-soft);
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .pill {
        flex-shrink: 0;
        margin-top: 1px;
      }
      .title {
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.45;
        color: var(--text);

        &:hover {
          color: var(--accent);
          text-decoration: underline;
        }
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        margin-top: 6px;
        margin-left: 78px;
        font-size: 11px;
      }
      .dot {
        opacity: 0.4;
      }
      .terms {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }
      .term {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--panel-3);
      }
      .term.pos {
        color: var(--up);
        background: var(--up-soft);
      }
      .filed {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--panel-3);
        cursor: help;
      }
      .term.neg {
        color: var(--down);
        background: var(--down-soft);
      }
      .disclaimer {
        margin: 0;
        padding: 11px 16px;
        border-top: 1px solid var(--border-soft);
        font-size: 10.5px;
        line-height: 1.5;
      }
      .unavailable {
        padding: 22px 18px;

        .head {
          margin: 0 0 5px;
          font-size: 13px;
          font-weight: 650;
        }
        p {
          margin: 0 0 6px;
          font-size: 12px;
          line-height: 1.5;
        }
        .small {
          font-size: 11px;
          max-width: 62ch;
        }
        code {
          font-family: var(--font-mono);
          font-size: 10.5px;
          padding: 1px 4px;
          border-radius: 3px;
          background: var(--panel-3);
        }
      }
      @media (max-width: 640px) {
        .meta {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class NewsFeed {
  readonly items = input.required<readonly (ScoredNewsItem | AttributedNewsItem)[]>();
  readonly state = input<FeedState>('ready');
  readonly error = input<string | null>(null);

  readonly disclaimer = SENTIMENT_DISCLAIMER;

  readonly summary = computed(() => summarise(this.items()));

  label(value: SentimentLabel): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  tone(value: SentimentLabel): string {
    return value === 'positive' ? 'good' : value === 'negative' ? 'bad' : 'muted';
  }

  /**
   * Which stocks a headline was filed under, if attribution ran on it.
   *
   * Shown next to the publisher with the matched words in the tooltip. The
   * instrument-page feed passes unattributed items — there the reader already
   * chose the instrument, so there is nothing to justify.
   */
  filedUnder(item: ScoredNewsItem | AttributedNewsItem): readonly Attribution[] {
    return 'attributions' in item ? item.attributions : [];
  }

  /** The tooltip on a stock chip: the words that put the headline there. */
  why(a: Attribution): string {
    return a.context
      ? `Filed under ${a.symbol}: the headline says "${a.matched}", confirmed by "${a.context}"`
      : `Filed under ${a.symbol}: the headline names it`;
  }

  ago(at: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
}
