/**
 * Attribution tests.
 *
 * Every "should not file" case below is a real headline returned by the live
 * feed for these companies, from publishers on the finance allowlist. They are
 * the reason this module exists: each one would otherwise have put a sentiment
 * score against a stock it says nothing about.
 *
 * The dropped-on-purpose cases are as important as the matched ones. This
 * prefers to lose a story rather than misfile it, and that trade-off is pinned
 * here so it cannot be quietly reversed.
 *
 * [4.1]
 */

import { describe, expect, it } from 'vitest';
import {
  COVERAGE,
  attribute,
  attributeAll,
  coveredInstruments,
  normalise,
} from './news-attribution';
import { scoreItem } from './sentiment';
import { FIXTURE_INSTRUMENTS } from './fixtures';
import type { NewsItem } from '../domain/news';

const item = (title: string, summary?: string): NewsItem => ({
  id: title,
  title,
  publisher: 'Test wire',
  link: 'https://example.test/story',
  publishedAt: new Date('2026-08-30T12:00:00Z'),
  relatedTickers: [],
  summary,
});

const filed = (title: string, summary?: string): string[] =>
  attribute(scoreItem(item(title, summary))).map((a) => a.symbol);

describe('news attribution', () => {
  describe('coverage table', () => {
    it('names only instruments that exist', () => {
      for (const coverage of COVERAGE) {
        expect(
          FIXTURE_INSTRUMENTS.some((i) => i.id === coverage.instrumentId),
          `unknown instrument ${coverage.instrumentId}`,
        ).toBe(true);
      }
    });

    it('covers every tradeable and suspended equity, and nothing else', () => {
      const equities = FIXTURE_INSTRUMENTS.filter((i) => i.classCode.startsWith('EQUITIES'));
      expect(
        coveredInstruments()
          .map((i) => i.id)
          .sort(),
      ).toEqual(equities.map((i) => i.id).sort());
    });
  });

  describe('normalising', () => {
    it('pads and collapses so matching is on word boundaries', () => {
      expect(normalise("Vodafone's Q3 — results!")).toBe(' vodafone s q3 results ');
    });
  });

  describe('unambiguous names file on their own', () => {
    it('files a ticker', () => {
      expect(filed('AAPL upgraded to buy at Morgan Stanley')).toEqual(['AAPL']);
    });

    it('files a full company name with no market context needed', () => {
      expect(filed('Reliance Industries commissions new refinery unit')).toEqual(['RELIANCE']);
    });

    it('files a name that is not an English word', () => {
      expect(filed('Infosys says subsidiary CEO unreachable after flood')).toEqual(['INFY']);
    });
  });

  describe('ambiguous names need market context', () => {
    it('files an ordinary word when a market term confirms it', () => {
      const found = attribute(scoreItem(item('Shell shares slide as refining margins weaken')));
      expect(found.map((a) => a.symbol)).toEqual(['SHEL']);
      expect(found[0].basis).toBe('name+context');
      expect(found[0].context).toBe('shares');
    });

    it('drops the same word with no market term anywhere', () => {
      // Real headline, from a publisher on the allowlist. Not this company.
      expect(filed('Cubs Minor League Wrap: Smokies shell Shuckers, 12-2')).toEqual([]);
    });

    it('drops "reliance" used as a common noun', () => {
      // CNBC, filed by the feed against a search for Reliance Industries.
      expect(filed('Iran trade falls as Khamenei urges less reliance on the U.S. dollar')).toEqual(
        [],
      );
    });

    it('records the basis so the UI can show why', () => {
      const found = attribute(scoreItem(item('Apple earnings beat as services revenue grows')));
      expect(found[0]).toMatchObject({ symbol: 'AAPL', basis: 'name+context', matched: 'apple' });
    });
  });

  describe('exclusions', () => {
    it('does not file a differently listed company with a containing name', () => {
      // Vodafone Idea is its own NSE listing. Related to VOD, not the same stock.
      expect(filed("Vodafone Idea's customer tide turns after long slump")).toEqual([]);
    });

    it('does not file a shell company story under Shell plc', () => {
      expect(filed('Regulator probes shell company network behind the deal')).toEqual([]);
    });

    it('does not file the rainforest under Amazon', () => {
      expect(filed('Amazon rainforest deforestation falls to a record low')).toEqual([]);
    });
  });

  describe('summaries', () => {
    it('reads the feed summary when the headline alone does not name the company', () => {
      expect(
        filed('Q3 profit beats estimates', 'Microsoft reported cloud growth ahead of forecasts'),
      ).toEqual(['MSFT']);
    });

    it('will not promote an ambiguous match on a market term found only in the summary', () => {
      // "apple" in the headline, "shares" only in the summary. A summary is long
      // enough to contain a market word by accident, so it cannot corroborate.
      expect(
        filed(
          'Apple orchard tour draws autumn crowds',
          'Visitors shares stories of the harvest market',
        ),
      ).toEqual([]);
    });
  });

  describe('one headline, two stocks', () => {
    it('files a story naming both companies under both', () => {
      expect(filed('Nvidia and Microsoft extend AI chip partnership').sort()).toEqual([
        'MSFT',
        'NVDA',
      ]);
    });
  });

  describe('filtering a set', () => {
    it('keeps only headlines that reached an instrument', () => {
      const kept = attributeAll(
        [
          item('Tesla deliveries beat expectations'),
          item('Weather warning issued for the south coast'),
          item('HSBC profits climb on higher rates'),
        ].map(scoreItem),
      );
      expect(kept.map((k) => k.title)).toEqual([
        'Tesla deliveries beat expectations',
        'HSBC profits climb on higher rates',
      ]);
    });
  });
});
