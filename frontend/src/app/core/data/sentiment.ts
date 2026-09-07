/**
 * Headline sentiment by lexicon match.
 *
 * WHAT THIS IS. A word list. Each headline is tokenised, matched against a
 * small set of finance terms, and scored by counting hits. Negation flips a
 * term when a negator appears within the two preceding words.
 *
 * WHAT THIS IS NOT. It is not a market signal, not a sentiment model, and not
 * investment advice. It cannot read sarcasm, context, magnitude, or whether a
 * headline is even about the instrument it is filed under. "Apple denies
 * slowdown" and "Apple confirms slowdown" score very differently for a reason
 * that has nothing to do with either being true.
 *
 * The upstream source provides no sentiment field of its own, so this is
 * computed here. The alternative — presenting an invented score next to a Buy
 * button — would be fabricating a financial signal, which is not acceptable on
 * a trading platform at any level of polish. Every score therefore exposes the
 * exact words it matched, so a reader can see precisely why it says what it
 * says and discount it accordingly.
 *
 * [4.1]
 */

import type { MatchedTerm, ScoredNewsItem, SentimentScore, SentimentSummary } from '../domain/news';
import type { AttributedNewsItem, NewsItem, StockSentiment } from '../domain/news';
import type { FixtureInstrument } from './fixtures';

/**
 * Terms are listed in the surface forms they actually appear in rather than
 * stemmed, so matching stays predictable and inspectable.
 */
const POSITIVE = new Set([
  'beat',
  'beats',
  'beating',
  'tops',
  'topped',
  'outperform',
  'outperforms',
  'surge',
  'surges',
  'surged',
  'soar',
  'soars',
  'soared',
  'jump',
  'jumps',
  'jumped',
  'rally',
  'rallies',
  'rallied',
  'climb',
  'climbs',
  'climbed',
  'rise',
  'rises',
  'rose',
  'gain',
  'gains',
  'gained',
  'upgrade',
  'upgraded',
  'upgrades',
  'record',
  'profit',
  'profits',
  'profitable',
  'growth',
  'grows',
  'grew',
  'strong',
  'stronger',
  'strength',
  'boost',
  'boosts',
  'boosted',
  'bullish',
  'optimistic',
  'approval',
  'approved',
  'wins',
  'won',
  'breakthrough',
  'expands',
  'expansion',
  'dividend',
  'buyback',
  'raises',
  'raised',
  'hikes',
  'recovery',
  'rebound',
  'rebounds',
  'milestone',
  'landmark',
]);

const NEGATIVE = new Set([
  'miss',
  'misses',
  'missed',
  'underperform',
  'underperforms',
  'plunge',
  'plunges',
  'plunged',
  'slump',
  'slumps',
  'slumped',
  'fall',
  'falls',
  'fell',
  'drop',
  'drops',
  'dropped',
  'sink',
  'sinks',
  'sank',
  'tumble',
  'tumbles',
  'tumbled',
  'slide',
  'slides',
  'slid',
  'decline',
  'declines',
  'declined',
  'downgrade',
  'downgraded',
  'downgrades',
  'loss',
  'losses',
  'lost',
  'cut',
  'cuts',
  'slash',
  'slashes',
  'slashed',
  'layoff',
  'layoffs',
  'redundancies',
  'warn',
  'warns',
  'warning',
  'probe',
  'probes',
  'investigation',
  'investigated',
  'lawsuit',
  'sue',
  'sues',
  'sued',
  'fine',
  'fined',
  'penalty',
  'fraud',
  'recall',
  'recalls',
  'halt',
  'halted',
  'suspend',
  'suspended',
  'suspension',
  'delay',
  'delays',
  'delayed',
  'bearish',
  'weak',
  'weaker',
  'weakness',
  'resign',
  'resigns',
  'resigned',
  'ousted',
  'scandal',
  'breach',
  'bankruptcy',
  'shortfall',
  'writedown',
  'impairment',
  'glut',
  'slowdown',
]);

/** A negator within this many preceding tokens flips a term's polarity. */
const NEGATION_WINDOW = 2;

const NEGATORS = new Set([
  'no',
  'not',
  'never',
  'without',
  'denies',
  'denied',
  'deny',
  'dismisses',
  'dismissed',
  'rejects',
  'rejected',
  'avoids',
  'avoided',
  'halts',
  'ends',
  'despite',
  'fails',
]);

/** Lowercase word tokens, punctuation stripped, possessives dropped. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Scores one headline. Pure and deterministic. */
export function scoreHeadline(headline: string): SentimentScore {
  const tokens = tokenise(headline);
  const matched: MatchedTerm[] = [];

  tokens.forEach((token, index) => {
    const base = POSITIVE.has(token) ? 'positive' : NEGATIVE.has(token) ? 'negative' : null;
    if (!base) return;

    const negated = tokens
      .slice(Math.max(0, index - NEGATION_WINDOW), index)
      .some((prior) => NEGATORS.has(prior));

    const polarity: 'positive' | 'negative' = negated
      ? base === 'positive'
        ? 'negative'
        : 'positive'
      : base;

    matched.push({ term: token, polarity, negated });
  });

  const positives = matched.filter((m) => m.polarity === 'positive').length;
  const negatives = matched.filter((m) => m.polarity === 'negative').length;
  const net = positives - negatives;

  return {
    label: net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral',
    net,
    positives,
    negatives,
    matched,
  };
}

export function scoreItem(item: NewsItem): ScoredNewsItem {
  return { ...item, sentiment: scoreHeadline(item.title) };
}

/** Counts across a set. Deliberately counts, not a percentage. */
export function summarise(items: readonly ScoredNewsItem[]): SentimentSummary {
  return {
    positive: items.filter((i) => i.sentiment.label === 'positive').length,
    neutral: items.filter((i) => i.sentiment.label === 'neutral').length,
    negative: items.filter((i) => i.sentiment.label === 'negative').length,
    total: items.length,
  };
}

/** Shown wherever a score is displayed. Not optional, not collapsible. */
export const SENTIMENT_DISCLAIMER =
  'Derived mechanically by matching headline wording against a fixed word list. ' +
  'It is not investment advice, not a recommendation, and not a measure of market sentiment.';

/**
 * Rolls attributed headlines up per instrument — the stock sentiment board.
 *
 * Three decisions worth keeping:
 *
 * 1. **A stock with no headlines is not neutral.** It is reported with a total
 *    of zero and rendered as "no headlines". Folding silence into neutral makes
 *    an unread stock look assessed.
 * 2. **Ordering is by how much was written, not by how positive it was.**
 *    Sorting the stocks by net score would put a league table of instruments on
 *    a trading screen, which is a recommendation in all but name. Rows carry
 *    their counts; the order carries nothing.
 * 3. **One headline can count for two stocks.** "Nvidia supplies Microsoft"
 *    is news about both, and splitting the credit would invent a weighting.
 *
 * [4.1]
 */
export function buildBoard(
  items: readonly AttributedNewsItem[],
  instruments: readonly FixtureInstrument[],
): readonly StockSentiment[] {
  return instruments
    .map((instrument): StockSentiment => {
      const mine = items
        .filter((item) => item.attributions.some((a) => a.instrumentId === instrument.id))
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      const counts = summarise(mine);
      return {
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        name: instrument.name,
        counts,
        net: counts.positive - counts.negative,
        latest: mine[0] ?? null,
        items: mine,
      };
    })
    .sort((a, b) => b.counts.total - a.counts.total || a.symbol.localeCompare(b.symbol));
}
