import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Attribution, AttributedNewsItem, MatchedTerm } from '../../core/news/news';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { ago, MOOD_GLYPH, MOOD_LABEL, MOOD_TONE } from './news-format';

/**
 * One headline in the News list. "Why?" opens the working behind it: the words
 * that set its mood and the words that filed it under each stock.
 */
@Component({
  selector: 'leap-headline-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, InstrumentLogo],
  template: `
    @let s = item().sentiment;
    <article class="row" [class]="variant()">
      @if (variant() !== 'compact') {
        <a class="thumb" [href]="item().link" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">
          @if (item().imageUrl && !broken()) {
            <img [src]="item().imageUrl" alt="" loading="lazy" referrerpolicy="no-referrer" (error)="broken.set(true)" />
          } @else if (firstSymbol(); as sym) {
            <leap-instrument-logo [symbol]="sym" [size]="36" />
          } @else {
            <leap-icon name="news" [size]="22" />
          }
        </a>
      }

      <div class="body">
        <a class="title" [href]="item().link" target="_blank" rel="noopener noreferrer">{{ item().title }}</a>
        @if (item().summary && variant() !== 'compact') {
          <p class="summary">{{ item().summary }}</p>
        }
        <div class="meta">
          <span class="pub">{{ item().publisher }}</span>
          <span class="sep">·</span>
          <time [attr.datetime]="item().publishedAt.toISOString()" [attr.title]="item().publishedAt.toLocaleString()">{{ when() }}</time>
          @for (a of item().attributions; track a.instrumentId) {
            <button type="button" class="chip" [class.on]="a.instrumentId === selected()" (click)="pickStock.emit(a.instrumentId)"
                    [attr.title]="'Show only ' + a.symbol + ' headlines'">
              {{ a.symbol }}
            </button>
          }
        </div>

        @if (open()) {
          <div class="why">
            <p>
              <strong>Mood:</strong>
              @if (s.matched.length === 0) {
                no scoring words matched, so it counts as neutral.
              } @else {
                {{ s.positives }} positive and {{ s.negatives }} negative {{ s.positives + s.negatives === 1 ? 'word' : 'words' }} counted
              }
            </p>
            @if (s.matched.length > 0) {
              <div class="terms">
                @for (m of s.matched; track $index) {
                  <code class="term" [class.pos]="m.counted && m.polarity === 'positive'" [class.neg]="m.counted && m.polarity === 'negative'"
                        [class.uncounted]="!m.counted" [attr.title]="termTitle(m)">{{ m.term }}{{ m.note ? ' ' + m.note : '' }}{{ m.negated ? ' (negated)' : '' }}{{ m.from === 'summary' ? ' (summary)' : '' }}</code>
                }
              </div>
            }
            @for (a of item().attributions; track a.instrumentId) {
              <p><strong>{{ a.symbol }}:</strong> {{ filedBecause(a) }}</p>
            }
          </div>
        }
      </div>

      <div class="side">
        <!-- In a tone column the column header already says the tone. -->
        @if (variant() !== 'compact') {
          <span class="sent" [class]="'sent-' + tone[s.label]">
            <i class="glyph">{{ glyph[s.label] }}</i>{{ label[s.label] }}
          </span>
        }
        <button type="button" class="why-btn" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          {{ open() ? 'Hide' : 'Why?' }}
        </button>
      </div>
    </article>
  `,
  styles: [
    `
      .row {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr) auto;
        gap: 16px;
        padding: 16px 22px;
        transition: background-color 0.12s ease;
      }
      .row:hover {
        background: var(--panel-hover);
      }
      .thumb {
        display: grid;
        place-items: center;
        width: 76px;
        height: 56px;
        border-radius: var(--radius);
        overflow: hidden;
        background: var(--panel-3);
        color: var(--text-3);
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .body {
        min-width: 0;
      }
      .title {
        font-size: 14.5px;
        font-weight: 600;
        line-height: 1.4;
        color: var(--text);
      }
      .title:hover {
        color: var(--accent);
        text-decoration: underline;
      }
      .summary {
        margin: 4px 0 0;
        font-size: 13px;
        line-height: 1.5;
        color: var(--text-2);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-3);
      }
      .pub {
        font-weight: 500;
        color: var(--text-2);
      }
      .sep {
        opacity: 0.6;
      }
      .chip {
        padding: 1px 7px;
        border-radius: 999px;
        border: 1px solid var(--border);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-2);
        transition: border-color 0.15s ease, color 0.15s ease;
      }
      .chip:hover,
      .chip.on {
        border-color: var(--accent);
        color: var(--accent);
      }
      .side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .side .sent {
        min-width: 92px;
        justify-content: center;
      }
      .why-btn {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-3);
      }
      .why-btn:hover {
        color: var(--accent);
      }
      .why {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: var(--radius);
        background: var(--panel-2);
        border: 1px dashed var(--border);
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--text-2);
        animation: leap-rise 0.18s var(--ease) both;
      }
      .why p {
        margin: 0 0 4px;
      }
      .why p:last-child {
        margin-bottom: 0;
      }
      .terms {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 2px 0 8px;
      }
      .term {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--panel-3);
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
      .row.compact {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        padding: 12px 16px;
      }
      .row.compact .title {
        font-size: 13.5px;
      }
      .row.simple .side .sent {
        min-width: 112px;
        padding: 5px 12px;
        font-size: 14px;
        font-weight: 600;
      }
      @media (max-width: 640px) {
        .row:not(.compact) {
          grid-template-columns: 56px minmax(0, 1fr);
          padding: 14px 16px;
          gap: 12px;
        }
        .thumb {
          width: 56px;
          height: 56px;
        }
        .side {
          grid-column: 2;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class HeadlineRow {
  readonly item = input.required<AttributedNewsItem>();
  /** The stock the page is filtered to, so its chip shows as active. */
  readonly selected = input<number | null>(null);
  /** `compact` for a tone column (no picture, summary or tone badge); `simple` for a bigger tone badge. */
  readonly variant = input<'full' | 'compact' | 'simple'>('full');
  readonly pickStock = output<number>();

  protected readonly open = signal(false);
  protected readonly broken = signal(false);
  protected readonly glyph = MOOD_GLYPH;
  protected readonly label = MOOD_LABEL;
  protected readonly tone = MOOD_TONE;

  protected readonly firstSymbol = computed(() => this.item().attributions[0]?.symbol ?? null);
  protected readonly when = computed(() => ago(this.item().publishedAt));

  termTitle(m: MatchedTerm): string {
    const parts = [
      m.counted ? `Counted as ${m.polarity}` : `Not counted (${m.note})`,
      m.negated ? 'flipped by a preceding negation' : null,
      m.from === 'summary' ? "found in the feed's summary, read because the headline matched nothing" : null,
    ];
    return parts.filter(Boolean).join('; ');
  }

  filedBecause(a: Attribution): string {
    return a.context
      ? `filed here because the headline says "${a.matched}", confirmed by "${a.context}".`
      : `filed here because the headline names "${a.matched}".`;
  }
}
