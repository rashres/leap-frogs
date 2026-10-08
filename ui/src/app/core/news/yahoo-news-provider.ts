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
import type { NewsItem } from './news';
import type { CoveredInstrument } from './news-attribution';
import { NewsUnavailable, type NewsProvider } from './news-provider';

const PROXY = '/api/yahoo';

interface YahooNewsEntry {
  readonly uuid?: string;
  readonly title?: string;
  readonly publisher?: string;
  readonly link?: string;
  readonly providerPublishTime?: number;
  readonly relatedTickers?: string[];
  readonly thumbnail?: {
    readonly resolutions?: readonly { readonly url?: string; readonly width?: number; readonly tag?: string }[];
  } | null;
}

/** Prefers Yahoo's square 140px crop, then the smallest image still wide enough for a thumbnail. */
function thumbnailOf(entry: YahooNewsEntry): string | undefined {
  const sizes = (entry.thumbnail?.resolutions ?? []).filter((r) => r.url);
  const square = sizes.find((r) => r.tag === '140x140');
  if (square) return square.url;
  return [...sizes].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((r) => (r.width ?? 0) >= 88)?.url ?? sizes[0]?.url;
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
      const imageUrl = thumbnailOf(entry);

      return [
        {
          id: entry.uuid ?? `${title}-${seconds}`,
          title,
          publisher: entry.publisher ?? 'Unknown source',
          link: entry.link ?? '#',
          publishedAt: new Date(seconds * 1000),
          relatedTickers: entry.relatedTickers ?? [],
          ...(imageUrl ? { imageUrl } : {}),
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
   * Yahoo search takes one term and has no daily allowance, so a sweep asks once
   * per covered ticker and merges the results; attribution then decides what
   * actually names a company.
   */
  async sweep(count: number, covered: readonly CoveredInstrument[]): Promise<readonly NewsItem[]> {
    if (covered.length === 0) return this.query('stock market', count);
    const perTicker = Math.max(5, Math.ceil(count / covered.length));
    const results = await Promise.allSettled(covered.map((i) => this.query(i.symbol, perTicker)));
    const answered = results.filter((r): r is PromiseFulfilledResult<readonly NewsItem[]> => r.status === 'fulfilled');
    if (answered.length === 0) throw (results[0] as PromiseRejectedResult).reason;
    const unique = new Map(answered.flatMap((r) => r.value).map((item) => [item.id, item]));
    return [...unique.values()].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
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
