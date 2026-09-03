/**
 * Headline sentiment tests.
 *
 * These pin the behaviour AND the limitations. Several cases below assert that
 * the scorer gets a headline "wrong" in a human sense — that is deliberate. A
 * word-list cannot read context, and pretending otherwise on a trading screen
 * would be the actual defect. The UI shows the matched words for exactly this
 * reason.
 *
 * [4.1]
 */

import { describe, expect, it } from 'vitest';
import {
  SENTIMENT_DISCLAIMER,
  buildBoard,
  scoreHeadline,
  scoreItem,
  summarise,
  tokenise,
} from './sentiment';
import type { ScoredNewsItem } from '../domain/news';
import { attributeAll, coveredInstruments } from './news-attribution';

describe('headline sentiment', () => {
  describe('tokenising', () => {
    it('lowercases, strips punctuation and drops possessives', () => {
      expect(tokenise("Apple's Q3 beats — profits surge!")).toEqual([
        'apple',
        'q3',
        'beats',
        'profits',
        'surge',
      ]);
    });
  });

  describe('scoring', () => {
    it('scores a clearly positive headline positive', () => {
      const score = scoreHeadline('Nvidia beats estimates as revenue surges to a record');
      expect(score.label).toBe('positive');
      expect(score.positives).toBe(3); // beats, surges, record
      expect(score.negatives).toBe(0);
      expect(score.matched.map((m) => m.term)).toContain('beats');
    });

    it('scores a clearly negative headline negative', () => {
      const score = scoreHeadline('Shares plunge after profit warning and downgrade');
      expect(score.label).toBe('negative');
      expect(score.matched.map((m) => m.term)).toEqual(
        expect.arrayContaining(['plunge', 'warning', 'downgrade']),
      );
    });

    it('scores a headline with no lexicon terms neutral', () => {
      const score = scoreHeadline('Apple announces annual shareholder meeting date');
      expect(score.label).toBe('neutral');
      expect(score.net).toBe(0);
      expect(score.matched).toHaveLength(0);
    });

    it('nets off a headline carrying both directions', () => {
      const score = scoreHeadline('Revenue beats but margins decline');
      expect(score.positives).toBe(1);
      expect(score.negatives).toBe(1);
      expect(score.net).toBe(0);
      expect(score.label).toBe('neutral');
    });

    it('exposes every matched term so a score can be audited', () => {
      const score = scoreHeadline('Tesla recall triggers lawsuit');
      expect(score.matched).toHaveLength(2);
      expect(score.matched.every((m) => m.polarity === 'negative')).toBe(true);
    });
  });

  describe('negation', () => {
    it('flips a term preceded by a negator', () => {
      const score = scoreHeadline('Apple denies slowdown in iPhone demand');
      const slowdown = score.matched.find((m) => m.term === 'slowdown');
      expect(slowdown?.negated).toBe(true);
      expect(slowdown?.polarity).toBe('positive');
      expect(score.label).toBe('positive');
    });

    it('does not flip a term outside the negation window', () => {
      // "not" is four words away, beyond the two-token window.
      const score = scoreHeadline('Not one analyst on the panel expects a downgrade');
      expect(score.matched.find((m) => m.term === 'downgrade')?.negated).toBe(false);
      expect(score.label).toBe('negative');
    });
  });

  describe('acknowledged limitations', () => {
    it('cannot read sarcasm or rhetorical framing', () => {
      // A human reads this as sceptical; the word list sees "compound" ... nothing,
      // and "higher" is not in the lexicon either, so it lands neutral.
      expect(scoreHeadline('Can MSFT Stock Compound Its Way Higher?').label).toBe('neutral');
    });

    it('scores on wording alone, not on who the headline is about', () => {
      // Filed under AAPL by the feed, but the sentiment here is about a rival.
      const score = scoreHeadline('Rival plunges as Apple gains market share');
      expect(score.positives).toBe(1);
      expect(score.negatives).toBe(1);
      // Net neutral, even though it is unambiguously good news for Apple.
      expect(score.label).toBe('neutral');
    });

    it('carries a disclaimer that names the method', () => {
      expect(SENTIMENT_DISCLAIMER).toMatch(/word list/i);
      expect(SENTIMENT_DISCLAIMER).toMatch(/not investment advice/i);
    });
  });

  describe('summarising', () => {
    it('reports counts rather than a percentage', () => {
      const items = [
        'Revenue beats expectations',
        'Shares plunge on downgrade',
        'Company schedules investor day',
      ].map(
        (title, i) =>
          ({
            id: String(i),
            title,
            publisher: 'Test',
            link: '#',
            publishedAt: new Date(),
            relatedTickers: [],
            sentiment: scoreHeadline(title),
          }) as ScoredNewsItem,
      );

      expect(summarise(items)).toEqual({ positive: 1, neutral: 1, negative: 1, total: 3 });
    });
  });
});

/**
 * The per-stock roll-up.
 *
 * The assertions that matter are the two about what the board refuses to say:
 * an unreported stock is not neutral, and the row order is not a ranking.
 *
 * [4.1]
 */
describe('stock sentiment board', () => {
  const covered = coveredInstruments();

  const headlines = (...titles: string[]) =>
    attributeAll(
      titles.map((title, index) =>
        scoreItem({
          id: `${index}`,
          title,
          publisher: 'Test wire',
          link: `https://example.test/${index}`,
          // Descending, so "latest" is unambiguous.
          publishedAt: new Date(Date.UTC(2026, 7, 30, 12 - index)),
          relatedTickers: [],
        }),
      ),
    );

  it("counts each stock's own headlines", () => {
    const board = buildBoard(
      headlines(
        'Nvidia beats estimates as revenue surges',
        'Nvidia downgraded on valuation concerns',
        'HSBC profits climb on higher rates',
      ),
      covered,
    );
    const nvda = board.find((row) => row.symbol === 'NVDA')!;
    expect(nvda.counts).toMatchObject({ positive: 1, negative: 1, total: 2 });
    expect(nvda.net).toBe(0);
  });

  it('reports a stock with no headlines as empty, never as neutral', () => {
    const board = buildBoard(headlines('HSBC profits climb on higher rates'), covered);
    const tcs = board.find((row) => row.symbol === 'TCS')!;
    expect(tcs.counts).toEqual({ positive: 0, neutral: 0, negative: 0, total: 0 });
    expect(tcs.latest).toBeNull();
  });

  it('orders by how much was written, not by how positive it was', () => {
    // TSLA has one glowing headline; MSFT has three, two of them negative. A
    // board ordered by sentiment would put Tesla top, which is a recommendation.
    const board = buildBoard(
      headlines(
        'Microsoft cloud revenue misses estimates',
        'Microsoft warns on AI capacity costs',
        'Microsoft raises dividend',
        'Tesla deliveries beat expectations and profits surge',
      ),
      covered,
    );
    expect(board[0].symbol).toBe('MSFT');
    expect(board[0].counts.total).toBe(3);
    expect(board[0].net).toBeLessThan(board.find((r) => r.symbol === 'TSLA')!.net);
  });

  it('counts a headline naming two companies under both', () => {
    const board = buildBoard(headlines('Nvidia and Microsoft extend AI chip partnership'), covered);
    expect(board.find((r) => r.symbol === 'NVDA')!.counts.total).toBe(1);
    expect(board.find((r) => r.symbol === 'MSFT')!.counts.total).toBe(1);
  });

  it("exposes the newest headline as the row's latest", () => {
    const board = buildBoard(
      headlines('Tesla recalls vehicles over software fault', 'Tesla deliveries beat expectations'),
      covered,
    );
    expect(board.find((r) => r.symbol === 'TSLA')!.latest?.title).toBe(
      'Tesla recalls vehicles over software fault',
    );
  });

  it('covers every board instrument even when nothing was written about any of them', () => {
    const board = buildBoard([], covered);
    expect(board).toHaveLength(covered.length);
    expect(board.every((row) => row.counts.total === 0)).toBe(true);
  });
});
