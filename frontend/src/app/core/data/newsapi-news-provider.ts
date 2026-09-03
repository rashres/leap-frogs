/**
 * Headlines from NewsAPI.org.
 *
 * Four things about this source are worth knowing before changing anything.
 *
 * 1. **The key never touches the browser.** Requests go to /api/news on the dev
 *    server, which attaches `X-Api-Key` from the environment and forwards to
 *    newsapi.org (proxy.conf.mjs). Nothing here knows the key, so nothing can
 *    leak it into the bundle, a network tab or a commit. A deployed build has
 *    no dev server: the Spring backend must own this call. See OQ-15.
 *
 * 2. **The plan withholds the last few hours, and does it silently.** A request
 *    with no upper bound comes back `{"status":"ok","totalResults":35609,
 *    "articles":[]}` — success, a large count, and nothing in it. Sending an
 *    explicit `to` of the current instant returns articles normally. Every
 *    request therefore carries both bounds. Without this the feed looks broken
 *    with no error to explain it.
 *
 * 3. **Body search is unusable for this.** `q=Apple` matches any story with the
 *    word anywhere, which on a live run returned a wildlife sanctuary and two
 *    PyPI package releases. Search is restricted to titles, and to a list of
 *    financial publishers. Precision matters more than volume here: a missed
 *    headline is invisible, a wrong one is scored and shown against a stock.
 *
 * 4. **It has no sentiment field.** Nothing in the payload is a score. Every
 *    score in this app is computed locally by the word list in sentiment.ts,
 *    which says plainly what it can and cannot do.
 *
 * [4.1]
 */

import { Injectable } from '@angular/core';
import type { NewsItem } from '../domain/news';
import { NewsUnavailable, type NewsProvider } from './news-provider';
import { COVERAGE } from './news-attribution';

const PROXY = '/api/news';

/** How far back a sweep looks. The plan's archive is shallow; a week is safe. */
const WINDOW_DAYS = 7;

/**
 * Publishers the sweep will accept.
 *
 * A domain allowlist is doing real disambiguation work, not editorial curation:
 * "Apple" in a Reuters headline is the company; in a lifestyle feed it is
 * usually not. Restricting the sources removes most of that noise before the
 * attribution rules ever see it.
 */
export const FINANCE_DOMAINS: readonly string[] = [
  'reuters.com',
  'cnbc.com',
  'bloomberg.com',
  'ft.com',
  'marketwatch.com',
  'investing.com',
  'fool.com',
  'benzinga.com',
  'businessinsider.com',
  'seekingalpha.com',
  'barrons.com',
  'thestreet.com',
  'forbes.com',
  'business-standard.com',
  'livemint.com',
  'economictimes.indiatimes.com',
  'moneycontrol.com',
  'cityam.com',
  'finance.yahoo.com',
];

interface NewsApiArticle {
  readonly source?: { readonly id?: string | null; readonly name?: string | null };
  readonly title?: string | null;
  readonly description?: string | null;
  readonly url?: string | null;
  readonly publishedAt?: string | null;
}

export interface NewsApiResponse {
  readonly status?: string;
  readonly code?: string;
  readonly message?: string;
  readonly totalResults?: number;
  readonly articles?: readonly NewsApiArticle[];
}

/** A withdrawn article. The feed keeps the row and blanks the fields. */
function isRemoved(article: NewsApiArticle): boolean {
  return article.title === '[Removed]' || article.url === 'https://removed.com';
}

/**
 * Turns a payload into items. Pure, so the tests need no network.
 *
 * Anything without a title, a link or a parseable timestamp is dropped rather
 * than defaulted: a headline stamped with "now" because its date was missing
 * would sort to the top of a feed and read as breaking news.
 */
export function parseNewsApi(payload: NewsApiResponse): readonly NewsItem[] {
  return (payload.articles ?? [])
    .filter((article) => !isRemoved(article))
    .flatMap((article): NewsItem[] => {
      const title = article.title?.trim();
      const link = article.url?.trim();
      const at = article.publishedAt ? new Date(article.publishedAt) : null;
      if (!title || !link || !at || Number.isNaN(at.getTime())) return [];

      return [
        {
          id: link,
          title,
          publisher: article.source?.name?.trim() || 'Unknown source',
          link,
          publishedAt: at,
          relatedTickers: [],
          summary: article.description?.trim() || undefined,
          source: 'newsapi',
        },
      ];
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

/**
 * The title query for a whole-universe sweep.
 *
 * Every name the attribution rules know about, so nothing is fetched that
 * cannot then be filed, and nothing fileable is left unfetched.
 */
export function sweepQuery(): string {
  const phrases = COVERAGE.flatMap((c) => [...c.names, ...c.ambiguous])
    // A single-word phrase needs no quoting and quoting it narrows nothing.
    .map((phrase) => (phrase.includes(' ') ? `"${phrase}"` : phrase));
  return [...new Set(phrases)].join(' OR ');
}

/** Maps an upstream failure onto something a reader can act on. */
export function describeFailure(status: number, body: NewsApiResponse | null): string {
  switch (body?.code) {
    case 'apiKeyMissing':
      return 'No news API key is configured. Set LEAP_NEWSAPI_KEY in frontend/.env.local and restart the dev server.';
    case 'apiKeyInvalid':
    case 'apiKeyDisabled':
      return 'The configured news API key was rejected by the provider.';
    case 'rateLimited':
      return 'The news plan’s daily request limit is used up. Headlines will return tomorrow.';
    case 'parametersMissing':
    case 'parameterInvalid':
      return `The news request was rejected: ${body.message ?? 'invalid parameters'}.`;
    default:
      return status === 426
        ? 'The requested date range is beyond what this news plan allows.'
        : `News request failed (HTTP ${status}).`;
  }
}

@Injectable({ providedIn: 'root' })
export class NewsApiProvider implements NewsProvider {
  readonly id = 'newsapi' as const;
  readonly label = 'NewsAPI.org';

  search(term: string, count: number): Promise<readonly NewsItem[]> {
    return this.everything(term.includes(' ') ? `"${term}"` : term, count);
  }

  sweep(count: number): Promise<readonly NewsItem[]> {
    return this.everything(sweepQuery(), count);
  }

  private async everything(qInTitle: string, count: number): Promise<readonly NewsItem[]> {
    const now = new Date();
    const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      qInTitle,
      domains: FINANCE_DOMAINS.join(','),
      language: 'en',
      sortBy: 'publishedAt',
      // Both bounds are mandatory in practice — see note 2 in the header.
      from: stamp(from),
      to: stamp(now),
      pageSize: String(Math.min(100, Math.max(1, count))),
    });

    let response: Response;
    try {
      response = await fetch(`${PROXY}/v2/everything?${params}`);
    } catch {
      throw new NewsUnavailable(
        'The news feed could not be reached. Live headlines are proxied through the dev server, so they need `npm start` rather than a static build.',
      );
    }

    const body = (await response.json().catch(() => null)) as NewsApiResponse | null;
    if (!response.ok || body?.status === 'error') {
      throw new NewsUnavailable(describeFailure(response.status, body));
    }
    return parseNewsApi(body ?? {});
  }
}

/** ISO-8601 to the second, which is the granularity the upstream accepts. */
function stamp(at: Date): string {
  return at.toISOString().slice(0, 19);
}
