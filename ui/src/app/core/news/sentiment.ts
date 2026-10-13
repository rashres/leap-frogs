/**
 * Headline sentiment by lexicon match.
 *
 * WHAT THIS IS. A word list. Each headline is tokenised, matched against a set
 * of finance phrases and terms, and scored by counting hits. Negation flips a
 * term when a negator appears within the two preceding words. In order:
 *
 * 1. An analyst price-target move stated in numbers ("price target to $400
 *    from $350") counts once, up or down by the numbers, and the verb that
 *    announced it ("adjusts", "cuts") is not counted again.
 * 2. Phrases are matched before single words, and the words they use are not
 *    counted again: "cut costs" is good news even though "cut" alone is not,
 *    and "price target hike" says more than "hike".
 * 3. Single words.
 * 4. A headline that is a question ("Is Apple a buy?") asserts nothing, so its
 *    terms are shown but not counted.
 * 5. If nothing in the headline counted, the feed's summary is read the same
 *    way. The headline decides whenever it says something definite.
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

import type { MatchedTerm, ScoredNewsItem, SentimentScore, SentimentSummary } from './news';
import type { AttributedNewsItem, NewsItem, StockSentiment } from './news';
import type { CoveredInstrument } from './news-attribution';

type Polarity = 'positive' | 'negative';

/**
 * Terms are listed in the surface forms they actually appear in rather than
 * stemmed, so matching stays predictable and inspectable.
 */
const POSITIVE = new Set([
  'beat', 'beats', 'beating',
  'tops', 'topped', 'topping',
  'outperform', 'outperforms', 'outperformed', 'outperforming',
  'surge', 'surges', 'surged', 'surging',
  'soar', 'soars', 'soared', 'soaring',
  'jump', 'jumps', 'jumped', 'jumping',
  'pop', 'pops', 'popped',
  'rally', 'rallies', 'rallied', 'rallying',
  'climb', 'climbs', 'climbed', 'climbing',
  'rise', 'rises', 'rose', 'rising',
  'gain', 'gains', 'gained', 'gaining',
  'reclaim', 'reclaims', 'reclaimed',
  'upgrade', 'upgraded', 'upgrades',
  'overweight',
  'upside',
  'record',
  'profit', 'profits', 'profitable',
  'growth', 'grows', 'grew',
  'strong', 'stronger', 'strength', 'robust', 'upbeat',
  'boost', 'boosts', 'boosted',
  'bullish', 'optimistic',
  'accelerates', 'accelerating', 'acceleration',
  'exceeds', 'exceeded', 'surpasses', 'surpassed',
  'tailwind', 'tailwinds',
  'boom', 'booming',
  'approval', 'approved',
  'wins', 'won',
  'breakthrough',
  'expands', 'expansion',
  'partnership',
  'dividend', 'buyback',
  'raises', 'raised', 'hikes',
  'recovery', 'rebound', 'rebounds', 'rebounded',
  'milestone', 'landmark',
]);

const NEGATIVE = new Set([
  'miss', 'misses', 'missed',
  'underperform', 'underperforms', 'underperformed',
  'underweight',
  'plunge', 'plunges', 'plunged', 'plunging',
  'plummet', 'plummets', 'plummeted',
  'slump', 'slumps', 'slumped', 'slumping',
  'fall', 'falls', 'fell', 'falling',
  'drop', 'drops', 'dropped', 'dropping',
  'sink', 'sinks', 'sank', 'sinking',
  'tumble', 'tumbles', 'tumbled', 'tumbling',
  'slide', 'slides', 'slid', 'sliding',
  'slip', 'slips', 'slipped', 'slipping',
  'tank', 'tanks', 'tanked',
  'crash', 'crashes', 'crashed',
  'selloff',
  'decline', 'declines', 'declined', 'declining',
  'downgrade', 'downgraded', 'downgrades',
  'downside',
  'loss', 'losses', 'lost', 'losing',
  'cut', 'cuts',
  'slash', 'slashes', 'slashed',
  'layoff', 'layoffs', 'redundancies',
  'warn', 'warns', 'warning',
  'probe', 'probes', 'investigation', 'investigated', 'antitrust',
  'lawsuit', 'lawsuits', 'sue', 'sues', 'sued',
  'fine', 'fined', 'penalty', 'fraud',
  'recall', 'recalls',
  'halt', 'halted',
  'suspend', 'suspended', 'suspension',
  'delay', 'delays', 'delayed',
  'outage', 'hack', 'hacked', 'cyberattack',
  'bearish', 'downbeat', 'gloomy',
  'weak', 'weaker', 'weakness', 'weakens', 'weakening',
  'slowing', 'slows', 'slowdown',
  'headwind', 'headwinds',
  'pressure', 'pressured', 'pressures',
  'threat', 'threats', 'threatens',
  'concern', 'concerns', 'fears', 'worries', 'worried',
  'resign', 'resigns', 'resigned', 'ousted',
  'scandal', 'breach',
  'bankrupt', 'bankruptcy',
  'shortfall', 'writedown', 'impairment', 'glut',
]);

/** Every combination of the given word lists, as token sequences. */
function combos(...parts: readonly (readonly string[])[]): string[][] {
  return parts.reduce<string[][]>((acc, words) => acc.flatMap((prefix) => words.map((w) => [...prefix, w])), [[]]);
}

const TARGET = ['target', 'targets'];
const OUTLOOK = ['guidance', 'outlook', 'forecast', 'forecasts'];
/** "six-year low", "52-week high", "multi-year low": the leading count, in words or digits. */
const SPANS = ['52', 'multi', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PERIODS = ['year', 'week', 'month'];
const UP_VERBS =['raises', 'raised', 'raise', 'lifts', 'lifted', 'hikes', 'hiked', 'boosts', 'boosted', 'ups'];
const DOWN_VERBS = ['cuts', 'cut', 'lowers', 'lowered', 'trims', 'trimmed', 'slashes', 'slashed', 'slash', 'reduces', 'reduced'];

/**
 * Multi-word terms, matched before single words. A phrase's words are not
 * counted again on their own, which is what lets "cut costs" be positive while
 * "cut" alone is negative.
 */
interface Phrase {
  readonly words: readonly string[];
  readonly polarity: Polarity;
}

const phrases = (polarity: Polarity, list: readonly (readonly string[])[]): Phrase[] =>
  list.map((words) => ({ words, polarity }));

const PHRASES: readonly Phrase[] = [
  ...phrases('positive', [
    ...combos(['price'], TARGET, ['hike', 'hikes', 'increase', 'increased', 'raise', 'raised', 'lifted', 'boost', 'boosted']),
    ...combos(UP_VERBS, ['price'], TARGET),
    ...combos(UP_VERBS, OUTLOOK),
    ...combos(['all'], ['time'], ['high', 'highs']),
    ...combos(['record', 'new', 'fresh'], ['high', 'highs']),
    ...combos(SPANS, PERIODS, ['high', 'highs']),
    ...combos(['cut', 'cuts', 'cutting'], ['costs', 'cost', 'spending']),
    ...combos(['cost'], ['cuts', 'cutting', 'savings']),
    ['buy', 'rating'],
    ['load', 'up'],
  ]),
  ...phrases('negative', [
    ...combos(['price'], TARGET, ['cut', 'cuts', 'lowered', 'reduced', 'trimmed', 'slashed']),
    ...combos(DOWN_VERBS, ['price'], TARGET),
    ...combos(DOWN_VERBS, OUTLOOK),
    ...combos(['all'], ['time'], ['low', 'lows']),
    ...combos(['record', 'new', 'fresh', 'multiyear'], ['low', 'lows']),
    ...combos(SPANS, PERIODS, ['low', 'lows']),
    ['sell', 'off'],
    ['sell', 'rating'],
  ]),
].sort((a, b) => b.words.length - a.words.length);

/** Verbs that announce a price-target move. Counted by the numbers instead, so not again as words. */
const TARGET_VERBS = new Set([...UP_VERBS, ...DOWN_VERBS, 'adjusts', 'adjusted', 'sets', 'set', 'moves', 'moved', 'tweaks', 'trimmed']);

const NUMBER = String.raw`\$?\s?([\d,]+(?:\.\d+)?)`;
/** "price target to $400 from $350" and "price target from $350 to $400", with a few words in between. */
const TARGET_TO_FROM = new RegExp(String.raw`\bprice[\s-]*targets?\b[^.?!$]{0,40}?\bto\s+${NUMBER}\s+from\s+${NUMBER}`, 'i');
const TARGET_FROM_TO = new RegExp(String.raw`\bprice[\s-]*targets?\b[^.?!$]{0,40}?\bfrom\s+${NUMBER}\s+to\s+${NUMBER}`, 'i');

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

const flip = (polarity: Polarity): Polarity => (polarity === 'positive' ? 'negative' : 'positive');
const amount = (text: string) => Number(text.replace(/,/g, ''));

/** Every term in one piece of text, in reading order, all counted. */
function matchText(text: string, from: MatchedTerm['from']): MatchedTerm[] {
  const matched: MatchedTerm[] = [];

  // 1. A price-target move in numbers, then the rest of the text without it.
  let rest = text;
  let skip: ReadonlySet<string> = new Set();
  const toFrom = TARGET_TO_FROM.exec(text);
  const fromTo = toFrom ? null : TARGET_FROM_TO.exec(text);
  const move = toFrom ? { to: amount(toFrom[1]), was: amount(toFrom[2]), at: toFrom } : fromTo ? { to: amount(fromTo[2]), was: amount(fromTo[1]), at: fromTo } : null;
  if (move && move.to !== move.was) {
    const up = move.to > move.was;
    matched.push({
      term: 'price target',
      polarity: up ? 'positive' : 'negative',
      negated: false,
      from,
      counted: true,
      note: `$${move.was} → $${move.to}`,
    });
    rest = text.slice(0, move.at.index) + ' ' + text.slice(move.at.index + move.at[0].length);
    skip = TARGET_VERBS;
  }

  const tokens = tokenise(rest);
  const used = new Set<number>();
  const negatedAt = (start: number) =>
    tokens.slice(Math.max(0, start - NEGATION_WINDOW), start).some((prior) => NEGATORS.has(prior));
  const found: { index: number; term: MatchedTerm }[] = [];

  // 2. Phrases, longest first; their tokens are then spoken for.
  for (const phrase of PHRASES) {
    const n = phrase.words.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      if (phrase.words.some((w, k) => tokens[i + k] !== w || used.has(i + k))) continue;
      for (let k = 0; k < n; k++) used.add(i + k);
      const negated = negatedAt(i);
      found.push({
        index: i,
        term: { term: phrase.words.join(' '), polarity: negated ? flip(phrase.polarity) : phrase.polarity, negated, from, counted: true },
      });
    }
  }

  // 3. Single words.
  tokens.forEach((token, i) => {
    if (used.has(i) || skip.has(token)) return;
    const base: Polarity | null = POSITIVE.has(token) ? 'positive' : NEGATIVE.has(token) ? 'negative' : null;
    if (!base) return;
    const negated = negatedAt(i);
    found.push({ index: i, term: { term: token, polarity: negated ? flip(base) : base, negated, from, counted: true } });
  });

  return [...matched, ...found.sort((a, b) => a.index - b.index).map((f) => f.term)];
}

/**
 * Scores one headline, falling back to its summary when the headline itself
 * matched nothing that counts. Pure and deterministic.
 */
export function scoreHeadline(headline: string, summary?: string): SentimentScore {
  let matched = matchText(headline, 'headline');

  // 4. A question asserts nothing.
  if (/\?\s*$/.test(headline.trim())) {
    matched = matched.map((m) => ({ ...m, counted: false, note: 'in a question' }));
  }

  // 5. The summary only speaks when the headline did not.
  if (summary && !matched.some((m) => m.counted)) {
    matched = [...matched, ...matchText(summary, 'summary')];
  }

  const counted = matched.filter((m) => m.counted);
  const positives = counted.filter((m) => m.polarity === 'positive').length;
  const negatives = counted.filter((m) => m.polarity === 'negative').length;
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
  return { ...item, sentiment: scoreHeadline(item.title, item.summary) };
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
  'Derived mechanically by matching headline wording (or the feed summary, when the headline matches nothing) ' +
  'against a fixed list of words and phrases. ' +
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
  instruments: readonly CoveredInstrument[],
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
