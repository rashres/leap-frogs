/**
 * The seam between the app and wherever headlines come from.
 *
 * Same shape and same reasoning as the quote-provider seam: the source is an
 * implementation detail, and swapping it must not change how a headline is
 * scored, attributed or displayed — only where it originated.
 *
 * A provider reports failure by rejecting with `NewsUnavailable`, carrying a
 * message written for a reader rather than a stack trace. It never returns
 * substitute content. There are no fixture headlines anywhere in this codebase:
 * invented news is the one kind of placeholder someone might act on.
 *
 * [4.1]
 */

import type { NewsItem, NewsSourceId } from '../domain/news';

export interface NewsProvider {
  readonly id: NewsSourceId;
  readonly label: string;

  /** Headlines mentioning one term — a ticker, or an instrument name. */
  search(term: string, count: number): Promise<readonly NewsItem[]>;

  /**
   * One pass over the whole covered stock universe.
   *
   * Deliberately a single call rather than one per instrument: the news plan in
   * use allows 100 requests a day, and eleven-per-refresh would exhaust it in
   * an afternoon of demoing. Which stock a story belongs to is then decided
   * locally and visibly — see news-attribution.ts.
   */
  sweep(count: number): Promise<readonly NewsItem[]>;
}

/** A failure a reader is shown verbatim. */
export class NewsUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsUnavailable';
  }
}
