/**
 * Filing a headline under an instrument.
 *
 * THE PROBLEM. A news feed searched for company names returns stories that are
 * not about the company. Observed in real responses from the configured
 * sources, all of them from the financial press:
 *
 *   "Iran trade falls as Khamenei urges less reliance on the U.S. dollar"
 *       — the word "reliance", not Reliance Industries.
 *   "Vodafone Idea's customer tide turns after long slump"
 *       — Vodafone Idea is a separately listed company, not Vodafone Group plc.
 *   "Cubs Minor League Wrap: Smokies shell Shuckers"
 *       — a verb.
 *
 * Left alone, each of those lands a sentiment score on a stock it has nothing
 * to do with. On a screen next to a Buy button that is not a cosmetic defect.
 *
 * THE RULE. A company name that is only a company name — "reliance industries",
 * "aapl", "vodafone group" — files the story on its own. A name that is also an
 * ordinary English word — "apple", "shell", "reliance", "amazon" — files it
 * only when a market term appears alongside it. Either way the reason is
 * recorded and rendered, so a reader can see the basis and reject it.
 *
 * WHAT THIS IS NOT. It is not entity resolution. It will miss stories that
 * never name the company, and it will occasionally file one wrongly. It errs
 * towards dropping a story rather than misfiling it, because an absent headline
 * costs a reader nothing and a misfiled one misleads them. The tests pin both
 * the cases it gets right and the cases it deliberately drops.
 *
 * [4.1]
 */

import type { Attribution, AttributedNewsItem, ScoredNewsItem } from '../domain/news';
import { FIXTURE_INSTRUMENTS, type FixtureInstrument } from './fixtures';

/**
 * Name matching for one instrument.
 *
 * `names` are unambiguous: a ticker, or a company name no one uses to mean
 * anything else. `ambiguous` are ordinary words that need corroboration.
 * `exclude` vetoes the whole item — a different company whose name contains
 * this one's.
 */
export interface Coverage {
  readonly instrumentId: string;
  readonly names: readonly string[];
  readonly ambiguous: readonly string[];
  readonly exclude: readonly string[];
}

/**
 * Market vocabulary that corroborates an ambiguous name.
 *
 * Kept to words that would be odd in a story about fruit, seashells or a
 * rainforest. "Price" and "sales" are deliberately absent: both are ordinary
 * retail words and would let consumer stories through.
 */
export const MARKET_TERMS: readonly string[] = [
  'stock',
  'stocks',
  'share',
  'shares',
  'shareholder',
  'shareholders',
  'earnings',
  'revenue',
  'profit',
  'profits',
  'guidance',
  'forecast',
  'quarter',
  'quarterly',
  'results',
  'dividend',
  'buyback',
  'valuation',
  'analyst',
  'analysts',
  'downgrade',
  'upgrade',
  'rating',
  'investor',
  'investors',
  'nasdaq',
  'nyse',
  'ftse',
  'sensex',
  'nifty',
  'bse',
  'nse',
  'market',
  'markets',
  'ipo',
  'plc',
  'inc',
  'ltd',
  'corp',
  'ceo',
  'cfo',
  'merger',
  'acquisition',
  'takeover',
  'stake',
  'wall',
  'street',
  'sec',
  'capitalisation',
  'capitalization',
  'marketcap',
  'premarket',
  'ticker',
];

/**
 * The covered universe: every tradeable equity in the fixture set.
 *
 * FX and crypto are absent on purpose. "Main stocks" means equities; a GBP/USD
 * or Bitcoin headline is reachable from the instrument page, where the reader
 * has already chosen the instrument and no attribution guesswork is involved.
 */
export const COVERAGE: readonly Coverage[] = [
  {
    instrumentId: 'us-aapl',
    names: ['aapl', 'apple inc'],
    ambiguous: ['apple'],
    exclude: ['apple cider', 'big apple', 'apple pie'],
  },
  { instrumentId: 'us-nvda', names: ['nvda', 'nvidia'], ambiguous: [], exclude: [] },
  {
    instrumentId: 'us-tsla',
    names: ['tsla', 'tesla inc', 'tesla'],
    ambiguous: [],
    exclude: ['nikola tesla', 'tesla coil'],
  },
  { instrumentId: 'us-msft', names: ['msft', 'microsoft'], ambiguous: [], exclude: [] },
  {
    instrumentId: 'us-amzn',
    names: ['amzn', 'amazon com', 'amazon web services'],
    ambiguous: ['amazon'],
    exclude: ['amazon rainforest', 'amazon river', 'amazon basin'],
  },

  {
    instrumentId: 'uk-shel',
    names: ['shel l', 'shell plc', 'royal dutch shell'],
    ambiguous: ['shell'],
    // A shell company is a structure, not this company; the rest are not finance.
    exclude: [
      'shell company',
      'shell companies',
      'shell corporation',
      'shell game',
      'shell casing',
    ],
  },
  { instrumentId: 'uk-hsba', names: ['hsba', 'hsbc'], ambiguous: [], exclude: [] },
  {
    instrumentId: 'uk-vod',
    names: ['vodafone group', 'vodafone plc', 'vod l'],
    ambiguous: ['vodafone'],
    // Vodafone Idea is separately listed on the NSE. A story about it is not a
    // story about Vodafone Group plc, however the two are related.
    exclude: ['vodafone idea', 'vi ltd'],
  },

  {
    instrumentId: 'in-reliance',
    names: ['reliance industries', 'reliance jio', 'ril'],
    ambiguous: ['reliance'],
    exclude: ['reliance on', 'self reliance', 'over reliance'],
  },
  { instrumentId: 'in-tcs', names: ['tata consultancy', 'tcs'], ambiguous: [], exclude: [] },
  { instrumentId: 'in-infy', names: ['infosys', 'infy'], ambiguous: [], exclude: [] },
];

/** The instruments the board covers, in fixture order. */
export function coveredInstruments(): readonly FixtureInstrument[] {
  return COVERAGE.map((c) => FIXTURE_INSTRUMENTS.find((i) => i.id === c.instrumentId)!).filter(
    Boolean,
  );
}

/**
 * Lowercased, punctuation reduced to single spaces, padded at both ends.
 *
 * Padding lets a phrase be matched with plain `includes` on space-delimited
 * boundaries, so "shell" does not match "shelled" and "vod" does not match
 * "vodafone".
 */
export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

function contains(haystack: string, phrase: string): boolean {
  return haystack.includes(` ${normalise(phrase).trim()} `);
}

/** The first market term present, or null. */
export function marketContext(normalisedText: string): string | null {
  return MARKET_TERMS.find((term) => contains(normalisedText, term)) ?? null;
}

/**
 * Which instruments a headline is about.
 *
 * Matched against the title and the feed's own summary when it has one: a
 * headline says "Q3 beats" and the summary says which company.
 */
export function attribute(item: ScoredNewsItem): readonly Attribution[] {
  const text = normalise(`${item.title} ${item.summary ?? ''}`);
  const titleOnly = normalise(item.title);
  const found: Attribution[] = [];

  for (const coverage of COVERAGE) {
    if (coverage.exclude.some((phrase) => contains(text, phrase))) continue;

    const symbol = FIXTURE_INSTRUMENTS.find((i) => i.id === coverage.instrumentId)?.symbol ?? '';

    const name = coverage.names.find((phrase) => contains(text, phrase));
    if (name) {
      found.push({ instrumentId: coverage.instrumentId, symbol, matched: name, basis: 'name' });
      continue;
    }

    const ambiguous = coverage.ambiguous.find((phrase) => contains(text, phrase));
    if (!ambiguous) continue;

    // Corroboration must be in the HEADLINE, never only in the summary. A
    // summary is long enough to contain "market" or "shares" incidentally —
    // "the farmers market" would otherwise file a produce story under Apple.
    const context = marketContext(titleOnly);
    if (!context) continue;

    found.push({
      instrumentId: coverage.instrumentId,
      symbol,
      matched: ambiguous,
      basis: 'name+context',
      context,
    });
  }

  return found;
}

export function attributeItem(item: ScoredNewsItem): AttributedNewsItem {
  return { ...item, attributions: attribute(item) };
}

/** Keeps only headlines that reached at least one instrument. */
export function attributeAll(items: readonly ScoredNewsItem[]): readonly AttributedNewsItem[] {
  return items.map(attributeItem).filter((item) => item.attributions.length > 0);
}
