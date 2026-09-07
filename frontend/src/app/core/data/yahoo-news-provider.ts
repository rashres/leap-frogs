/**
 * Headlines from Yahoo Finance search.
 *
 * The keyless fallback. It was the original source here and is kept because it
 * needs no credential and no plan: when the news key is missing or its daily
 * allowance is spent, this still answers, and a reader sees headlines instead
 * of an apology. Like the quote adapter it sends no CORS headers, so it goes
 * through the dev-server proxy at /api/yahoo.
 *
 * It carries `relatedTickers`, which the app does not use for the stock board.
 * The field is the feed's own claim about what a story is about, and it is
 * frequently wrong in the direction that matters — a story about a competitor
 * filed under the competitor's rival. Attribution is done locally instead, by
 * rules that show their working.
 *
 * [4.1]
 */

import { Injectable } from '@angular/core';
import type { NewsItem } from '../domain/news';
import { NewsUnavailable, type NewsProvider } from './news-provider';

const PROXY = '/api/yahoo';

interface YahooNewsEntry {
  readonly uuid?: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly link?: string;
  readonly providerPublishTime?: number;
  readonly relatedTickers?: string[];
}

export interface YahooSearchResponse {
  readonly news?: readonly YahooNewsEntry[];
}

/** Parses a search payload. Pure, so tests need no network. */
export function parseYahooNews(payload: YahooSearchResponse): readonly NewsItem[] {
  return (payload.news ?? [])
    .flatMap((entry): NewsItem[] => {
      const title = entry.title?.trim();
      const seconds = entry.providerPublishTime;
      if (!title || typeof seconds !== 'number') return [];

      return [
        {
          id: entry.uuid ?? `${title}-${seconds}`,
          title,
          publisher: entry.publisher ?? 'Unknown source',
          link: entry.link ?? '#',
          publishedAt: new Date(seconds * 1000),
          relatedTickers: entry.relatedTickers ?? [],
          source: 'yahoo',
        },
      ];
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

@Injectable({ providedIn: 'root' })
export class YahooNewsProvider implements NewsProvider {
  readonly id = 'yahoo' as const;
  readonly label = 'Yahoo Finance';

  search(term: string, count: number): Promise<readonly NewsItem[]> {
    return this.query(term, count);
  }

  /**
   * Yahoo search takes one term, so a universe sweep asks the broad market
   * question and lets attribution decide what landed. Less precise than the
   * primary source by design — this is the fallback, not the intent.
   */
  sweep(count: number): Promise<readonly NewsItem[]> {
    return this.query('stock market', count);
  }

  private async query(term: string, count: number): Promise<readonly NewsItem[]> {
    const url =
      `${PROXY}/v1/finance/search?q=${encodeURIComponent(term)}` +
      `&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new NewsUnavailable(
        'The fallback news feed could not be reached. Live headlines are proxied through the dev server, so they need `npm start` rather than a static build.',
      );
    }

    if (!response.ok) {
      throw new NewsUnavailable(
        response.status === 429
          ? 'Yahoo is rate-limiting this IP (429). Fallback headlines are temporarily unavailable.'
          : `Fallback news request failed (HTTP ${response.status}).`,
      );
    }
    return parseYahooNews((await response.json()) as YahooSearchResponse);
  }
}
