/**
 * NewsAPI adapter tests.
 *
 * Parsing and failure mapping only — canned payloads, no network, deterministic
 * like the rest of the suite.
 *
 * The cases that matter here are the ones where the upstream returns something
 * that looks usable and is not: a withdrawn article that keeps its row, an
 * article with no timestamp, and an HTTP 200 carrying `status: "error"`. Each
 * would otherwise reach a reader as a real headline.
 *
 * [4.1]
 */

import { describe, expect, it } from 'vitest';
import {
  FINANCE_DOMAINS,
  describeFailure,
  parseNewsApi,
  sweepQuery,
  type NewsApiResponse,
} from './newsapi-news-provider';
import { COVERAGE } from './news-attribution';

const article = (over: Record<string, unknown> = {}) => ({
  source: { id: null, name: 'Reuters' },
  title: 'Shell shares slide on refining margins',
  description: 'Weaker downstream margins weighed on the quarter.',
  url: 'https://reuters.test/shell-margins',
  publishedAt: '2026-08-30T09:15:00Z',
  ...over,
});

describe('NewsAPI adapter', () => {
  describe('parsing', () => {
    it('maps an article onto a NewsItem', () => {
      const [item] = parseNewsApi({ articles: [article()] });
      expect(item).toMatchObject({
        title: 'Shell shares slide on refining margins',
        publisher: 'Reuters',
        link: 'https://reuters.test/shell-margins',
        summary: 'Weaker downstream margins weighed on the quarter.',
        source: 'newsapi',
      });
      expect(item.publishedAt.toISOString()).toBe('2026-08-30T09:15:00.000Z');
    });

    it('carries no feed-supplied tickers, because this feed supplies none', () => {
      expect(parseNewsApi({ articles: [article()] })[0].relatedTickers).toEqual([]);
    });

    it('drops withdrawn articles, which keep their row and blank their fields', () => {
      const payload: NewsApiResponse = {
        articles: [article({ title: '[Removed]', url: 'https://removed.com' }), article()],
      };
      expect(parseNewsApi(payload)).toHaveLength(1);
    });

    it('drops an article with no timestamp rather than stamping it now', () => {
      // A missing date defaulted to "now" sorts to the top and reads as breaking.
      expect(parseNewsApi({ articles: [article({ publishedAt: null })] })).toEqual([]);
    });

    it('drops an article with an unparseable timestamp', () => {
      expect(parseNewsApi({ articles: [article({ publishedAt: 'not a date' })] })).toEqual([]);
    });

    it('drops an article with no title or no link', () => {
      expect(
        parseNewsApi({ articles: [article({ title: '   ' }), article({ url: null })] }),
      ).toEqual([]);
    });

    it('falls back to a named source rather than an empty publisher', () => {
      expect(parseNewsApi({ articles: [article({ source: {} })] })[0].publisher).toBe(
        'Unknown source',
      );
    });

    it('returns newest first', () => {
      const items = parseNewsApi({
        articles: [
          article({ url: 'https://a.test/1', publishedAt: '2026-08-28T00:00:00Z' }),
          article({ url: 'https://a.test/2', publishedAt: '2026-08-30T00:00:00Z' }),
          article({ url: 'https://a.test/3', publishedAt: '2026-08-29T00:00:00Z' }),
        ],
      });
      expect(items.map((i) => i.link)).toEqual([
        'https://a.test/2',
        'https://a.test/3',
        'https://a.test/1',
      ]);
    });

    it('tolerates a payload with no articles field at all', () => {
      expect(parseNewsApi({})).toEqual([]);
    });
  });

  describe('sweep query', () => {
    it('asks for every name attribution can file, and nothing it cannot', () => {
      const query = sweepQuery();
      for (const coverage of COVERAGE) {
        for (const name of [...coverage.names, ...coverage.ambiguous]) {
          const expected = name.includes(' ') ? `"${name}"` : name;
          expect(query, `missing ${name}`).toContain(expected);
        }
      }
    });

    it('quotes multi-word names so they match as phrases', () => {
      expect(sweepQuery()).toContain('"reliance industries"');
    });

    it('stays inside the upstream 500-character query limit', () => {
      expect(sweepQuery().length).toBeLessThanOrEqual(500);
    });
  });

  describe('publisher allowlist', () => {
    it('is bare domains, which is what the upstream matches on', () => {
      for (const domain of FINANCE_DOMAINS) {
        expect(domain, domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      }
    });
  });

  describe('failure messages', () => {
    it('tells the operator where the key goes when there is none', () => {
      expect(describeFailure(401, { status: 'error', code: 'apiKeyMissing' })).toContain(
        'LEAP_NEWSAPI_KEY',
      );
    });

    it('distinguishes a rejected key from a missing one', () => {
      expect(describeFailure(401, { status: 'error', code: 'apiKeyInvalid' })).toContain(
        'rejected',
      );
    });

    it('says the allowance is spent rather than that the feed is broken', () => {
      expect(describeFailure(429, { status: 'error', code: 'rateLimited' })).toContain('limit');
    });

    it('quotes the upstream message when it rejected the parameters', () => {
      expect(
        describeFailure(400, { status: 'error', code: 'parameterInvalid', message: 'too long' }),
      ).toContain('too long');
    });

    it('falls back to the status code for anything unrecognised', () => {
      expect(describeFailure(503, null)).toContain('503');
    });
  });
});
