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

import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type {
  Attribution,
  AttributedNewsItem,
  MatchedTerm,
  ScoredNewsItem,
  SentimentLabel,
  SentimentScore,
} from '../core/news/news';
import { SENTIMENT_DISCLAIMER, summarise } from '../core/news/sentiment';
import type { FeedState } from '../core/news/news.service';
import { translate } from '../core/i18n/i18n.service';
import { TPipe } from '../core/i18n/t.pipe';

/** Headlines shown at first, and added by each "Show more". */
const PAGE = 25;

@Component({
  selector: 'leap-news-feed',
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = summary();

    @if (items().length > 0) {
      <div class="bar">
        <div class="counts">
          <span class="sent sent-pos"><i class="glyph">▲</i>{{ '{n} positive' | t: { n: s.positive } }}</span>
          <span class="sent sent-neu"><i class="glyph">■</i>{{ '{n} neutral' | t: { n: s.neutral } }}</span>
          <span class="sent sent-neg"><i class="glyph">▼</i>{{ '{n} negative' | t: { n: s.negative } }}</span>
        </div>
        <span class="of faint">{{ 'of {n} headlines' | t: { n: s.total } }}</span>
      </div>
    }

    @switch (state()) {
      @case ('loading') {
        <p class="sr-only" role="status">{{ 'Loading headlines…' | t }}</p>
        <ul class="loading" aria-hidden="true">
          @for (n of [1, 2, 3, 4]; track n) {
            <li class="row">
              <span class="skeleton" style="width: 72px; height: 20px"></span>
              <span class="body">
                <span class="skeleton" style="width: 85%; height: 14px"></span>
                <span class="skeleton" style="width: 40%; margin-top: 10px"></span>
              </span>
            </li>
          }
        </ul>
      }
      @case ('unavailable') {
        <div class="unavailable">
          <p class="head">{{ 'Headlines unavailable' | t }}</p>
          <p class="faint">{{ (error() ?? 'The news feed could not be reached.') | t }}</p>
          <p class="faint small">
            {{ 'Headlines are fetched through the LilyPad server, so it must be running. No placeholder headlines are shown here on purpose — invented news is the one kind of filler a reader might act on.' | t }}
          </p>
        </div>
      }
      @default {
        @if (items().length === 0) {
          <p class="empty"><span class="empty-title">{{ 'No headlines yet' | t }}</span>{{ 'Nothing has been published for this instrument in the news window.' | t }}</p>
        } @else {
          <ul>
            @for (item of shown(); track item.id) {
              <li>
                <div class="row">
                  <span
                    class="sent"
                    [class]="'sent-' + tone(item.sentiment.label)"
                    [attr.title]="explain(item.sentiment)"
                  >
                    <i class="glyph">{{ glyph(item.sentiment.label) }}</i>
                    {{ label(item.sentiment.label) }}
                    @if (item.sentiment.net !== 0) {
                      <span class="net">{{ item.sentiment.net > 0 ? '+' : '−'
                        }}{{ abs(item.sentiment.net) }}</span>
                    }
                  </span>
                  <div class="body">
                  <a class="title" [href]="item.link" target="_blank" rel="noopener noreferrer">
                    {{ item.title }}
                  </a>
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
                      {{ 'matched' | t }}
                      @for (m of item.sentiment.matched; track $index) {
                        <code
                          class="term"
                          [class.pos]="m.counted && m.polarity === 'positive'"
                          [class.neg]="m.counted && m.polarity === 'negative'"
                          [class.uncounted]="!m.counted"
                          [attr.title]="termTitle(m)"
                          >{{ m.term }}{{ m.note ? ' ' + (m.note | t) : '' }}{{ m.negated ? ' ' + ('(negated)' | t) : '' }}{{
                            m.from === 'summary' ? ' ' + ('(summary)' | t) : ''
                          }}</code
                        >
                      }
                    </span>
                  }
                </div>
                  </div>
                </div>
              </li>
            }
          </ul>
          @if (hidden() > 0) {
            <div class="more">
              <button type="button" class="btn btn-secondary btn-sm" (click)="showMore()">
                {{ 'Show {n} more' | t: { n: nextBatch() } }}
              </button>
              <span class="faint">{{ '{n} not shown' | t: { n: hidden() } }}</span>
            </div>
          }
          <p class="disclaimer faint">{{ disclaimer | t }}</p>
        }
      }
    }
  `,
  styles: [
    `
      .bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        padding: 14px 22px;
        border-bottom: 1px solid var(--border-soft);
        background: var(--panel-2);
      }
      .counts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .of {
        font-size: 12px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        padding: 16px 22px;
        transition: background-color 0.12s ease;
      }
      li:not(.row):hover {
        background: var(--panel-hover);
      }
      li + li {
        border-top: 1px solid var(--border-soft);
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }
      .body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .sent {
        flex-shrink: 0;
        margin-top: 1px;
        min-width: 86px;
        justify-content: center;
      }
      .title {
        font-size: 14.5px;
        font-weight: 600;
        line-height: 1.45;
        color: var(--text);
        border-radius: 4px;

        &:hover {
          color: var(--accent);
        }
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        font-size: 12px;
      }
      .dot {
        opacity: 0.5;
      }
      .terms {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }
      .term,
      .filed {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--panel-3);
        color: var(--text-2);
      }
      .filed {
        cursor: help;
        font-weight: 600;
      }
      .term.pos {
        color: var(--up);
        background: var(--up-soft);
      }
      .term.neg {
        color: var(--down);
        background: var(--down-soft);
      }
      .term.uncounted {
        text-decoration: line-through;
        opacity: 0.75;
      }
      .more {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 22px;
        border-top: 1px solid var(--border-soft);
        font-size: 12.5px;
      }
      .disclaimer {
        margin: 0;
        padding: 14px 22px;
        border-top: 1px solid var(--border-soft);
        background: var(--panel-2);
        font-size: 12px;
        line-height: 1.55;
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      }
      .unavailable {
        padding: 28px 22px;

        .head {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 600;
        }
        p {
          margin: 0 0 6px;
          font-size: 13px;
          line-height: 1.55;
        }
        .small {
          font-size: 12px;
          max-width: 68ch;
        }
        code {
          font-family: var(--font-mono);
          font-size: 11.5px;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--panel-3);
        }
      }
      @media (max-width: 640px) {
        li {
          padding: 14px 16px;
        }
        .row {
          flex-direction: column;
          gap: 8px;
        }
        .loading .row {
          flex-direction: row;
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

  /** How many headlines are on screen. Starts over when the list changes, e.g. a different stock is picked. */
  private readonly limit = linkedSignal({ source: this.items, computation: () => PAGE });
  readonly shown = computed(() => this.items().slice(0, this.limit()));
  readonly hidden = computed(() => Math.max(0, this.items().length - this.limit()));
  readonly nextBatch = computed(() => Math.min(PAGE, this.hidden()));

  showMore(): void {
    this.limit.update((n) => n + PAGE);
  }

  /** Tooltip on one matched term: what it counted as and why. */
  termTitle(m: MatchedTerm): string {
    const parts = [
      m.counted ? translate(m.polarity === 'positive' ? 'Counted as positive' : 'Counted as negative') : translate('Not counted ({note})', { note: translate(m.note ?? '') }),
      m.negated ? translate('flipped by a preceding negation') : null,
      m.from === 'summary' ? translate('found in the feed’s summary, read because the headline matched nothing') : null,
    ];
    return parts.filter(Boolean).join('; ');
  }

  label(value: SentimentLabel): string {
    return translate(value === 'positive' ? 'Positive' : value === 'negative' ? 'Negative' : 'Neutral');
  }

  tone(value: SentimentLabel): string {
    return value === 'positive' ? 'pos' : value === 'negative' ? 'neg' : 'neu';
  }

  /** Shape as well as colour, so the label survives a colour-blind reader. */
  glyph(value: SentimentLabel): string {
    return value === 'positive' ? '▲' : value === 'negative' ? '▼' : '■';
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  /**
   * Tooltip behind the count. States what the number counts, because `net` is a
   * tally of matched words and nothing more — see SentimentScore in domain/news.
   */
  explain(score: SentimentScore): string {
    const counted = score.positives + score.negatives;
    if (counted === 0) {
      return score.matched.length === 0
        ? translate('No lexicon terms matched this headline.')
        : translate('Terms matched, but none counted (the headline is a question).');
    }
    return translate('Counted {pos} positive and {neg} negative terms. Counts of matched words, not a confidence score.', {
      pos: score.positives,
      neg: score.negatives,
    });
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
      ? translate('Filed under {symbol}: the headline says “{matched}”, confirmed by “{context}”', { symbol: a.symbol, matched: a.matched, context: a.context })
      : translate('Filed under {symbol}: the headline names it', { symbol: a.symbol });
  }

  ago(at: Date): string {
    const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000));
    if (minutes < 1) return translate('just now');
    if (minutes < 60) return translate('{n}m ago', { n: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return translate('{n}h ago', { n: hours });
    return translate('{n}d ago', { n: Math.round(hours / 24) });
  }
}
