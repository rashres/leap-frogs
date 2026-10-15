/**
 * Headlines from Yahoo Finance search and its per-ticker headline RSS.
 *
 * The keyless fallback. It was the original source here and is kept because it
 * needs no credential and no plan: when the news key is missing or its daily
 * allowance is spent, this still answers, and a reader sees headlines instead
 * of an apology. Yahoo sends no CORS headers, so requests go through the
 * LEAP API at /api/yahoo, which fetches and caches them server-side.
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

/**
 * Headlines asked for per ticker in a sweep. Yahoo has no daily allowance, and
 * search returns about four in five of what is asked for, so ask generously:
 * at 50 a sweep has a few hundred headlines to file instead of a couple dozen.
 */
const SWEEP_PER_TICKER = 50;

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

/**
 * The image is shown up to a full-width 16:9 news card, so the 140px crop
 * blurs. Takes the smallest image at least SHARP_WIDTH wide (sharp on
 * high-density screens), or the largest there is.
 */
const SHARP_WIDTH = 800;

function thumbnailOf(entry: YahooNewsEntry): string | undefined {
  const sizes = [...(entry.thumbnail?.resolutions ?? [])]
    .filter((r) => r.url)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sizes.find((r) => (r.width ?? 0) >= SHARP_WIDTH) ?? sizes[sizes.length - 1])?.url;
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

const XML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== '#') return XML_ENTITIES[code.toLowerCase()] ?? whole;
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    })
    .trim();
}

/**
 * Parses Yahoo's per-ticker headline RSS. Pure, so tests need no network. The
 * feed's guid is the same uuid search uses, so the two merge cleanly; it names
 * no publisher and carries no image, but it does carry a one-line summary,
 * which search does not.
 */
export function parseYahooRss(xml: string, ticker: string): readonly NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap((match): NewsItem[] => {
    const field = (tag: string) => decodeXml(match[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '');
    const title = field('title');
    const publishedAt = new Date(field('pubDate'));
    if (!title || Number.isNaN(publishedAt.getTime())) return [];
    const summary = field('description');
    return [
      {
        id: field('guid') || field('link') || `${title}-${publishedAt.getTime()}`,
        title,
        publisher: 'Yahoo Finance',
        link: field('link') || '#',
        publishedAt,
        relatedTickers: [ticker],
        ...(summary ? { summary } : {}),
        source: 'yahoo',
      },
    ];
  });
}

/** Lowercase letters and digits only, so "Apple’s" and "Apple's" are the same story. */
function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * One item per story, newest first. The same story arrives from search and
 * RSS, and from several tickers' searches; copies are matched by id, then by
 * title, and the first copy kept is filled in with whatever a later one adds
 * (search brings the publisher and image, RSS the summary).
 */
export function mergeNews(items: readonly NewsItem[]): readonly NewsItem[] {
  const byId = new Map<string, NewsItem>();
  const idOfTitle = new Map<string, string>();
  for (const item of items) {
    const id = byId.has(item.id) ? item.id : (idOfTitle.get(titleKey(item.title)) ?? item.id);
    const kept = byId.get(id);
    if (!kept) {
      byId.set(id, item);
      idOfTitle.set(titleKey(item.title), id);
      continue;
    }
    byId.set(id, {
      ...kept,
      publisher: kept.publisher === 'Yahoo Finance' ? item.publisher : kept.publisher,
      relatedTickers: [...new Set([...kept.relatedTickers, ...item.relatedTickers])],
      ...(kept.summary ?? item.summary ? { summary: kept.summary ?? item.summary } : {}),
      ...(kept.imageUrl ?? item.imageUrl ? { imageUrl: kept.imageUrl ?? item.imageUrl } : {}),
    });
  }
  return [...byId.values()].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

@Injectable({ providedIn: 'root' })
export class YahooNewsProvider implements NewsProvider {
  readonly id = 'yahoo' as const;
  readonly label = 'Yahoo Finance';

  search(term: string, count: number): Promise<readonly NewsItem[]> {
    return this.query(term, count);
  }

  /**
   * Yahoo search takes one term and has no daily allowance, so a sweep asks
   * search and the headline RSS once per covered ticker and merges the results;
   * attribution then decides what actually names a company. A source that fails
   * for one ticker costs only its share; the sweep fails only if all of them do.
   * `count` is NewsAPI's whole-sweep budget and does not apply here.
   */
  async sweep(_count: number, covered: readonly CoveredInstrument[]): Promise<readonly NewsItem[]> {
    if (covered.length === 0) return this.query('stock market', SWEEP_PER_TICKER);
    const results = await Promise.allSettled(
      covered.flatMap((i) => [this.query(i.symbol, SWEEP_PER_TICKER), this.rss(i.symbol)]),
    );
    const answered = results.filter((r): r is PromiseFulfilledResult<readonly NewsItem[]> => r.status === 'fulfilled');
    if (answered.length === 0) throw (results[0] as PromiseRejectedResult).reason;
    return mergeNews(answered.flatMap((r) => r.value));
  }

  private async rss(ticker: string): Promise<readonly NewsItem[]> {
    const response = await fetch(`${PROXY}/rss/2.0/headline?s=${encodeURIComponent(ticker)}`);
    if (!response.ok) throw new NewsUnavailable(`Yahoo headline feed failed for ${ticker} (HTTP ${response.status}).`);
    return parseYahooRss(await response.text(), ticker);
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
        'The fallback news feed could not be reached. Headlines come through the LEAP API, so check that it is running.',
      );
    }

    if (!response.ok) {
      throw new NewsUnavailable(
        response.status === 429
          ? 'Yahoo is rate-limiting this IP (429). Fallback headlines are temporarily unavailable.'
          : response.status === 502 || response.status === 504
            ? 'Yahoo Finance is not answering right now. Fallback headlines are temporarily unavailable.'
            : `Fallback news request failed (HTTP ${response.status}).`,
      );
    }
    return parseYahooNews((await response.json()) as YahooSearchResponse);
  }
}
