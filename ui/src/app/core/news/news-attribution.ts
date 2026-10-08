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

import type { Attribution, AttributedNewsItem, ScoredNewsItem } from './news';

/**
 * Name matching for one instrument.
 *
 * `names` are unambiguous: a ticker, or a company name no one uses to mean
 * anything else. `ambiguous` are ordinary words that need corroboration.
 * `exclude` vetoes the whole item — a different company whose name contains
 * this one's.
 */
export interface Coverage {
  readonly names: readonly string[];
  readonly ambiguous: readonly string[];
  readonly exclude: readonly string[];
}

/** A database instrument the board covers, with its matching rules. */
export interface CoveredInstrument {
  readonly id: number;
  readonly symbol: string;
  readonly name: string;
  readonly coverage: Coverage;
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
 * Hand-tuned matching rules by ticker, from fe/21-page-mascots. An equity in
 * the database without an entry here gets genericCoverage().
 *
 * FX and crypto are absent on purpose. "Main stocks" means equities; a GBP/USD
 * or Bitcoin headline is reachable from the instrument page, where the reader
 * has already chosen the instrument and no attribution guesswork is involved.
 */
export const COVERAGE: Readonly<Record<string, Coverage>> = {
  AAPL: {
    names: ['aapl', 'apple inc'],
    ambiguous: ['apple'],
    exclude: ['apple cider', 'big apple', 'apple pie'],
  },
  NVDA: { names: ['nvda', 'nvidia'], ambiguous: [], exclude: [] },
  TSLA: {
    names: ['tsla', 'tesla inc', 'tesla'],
    ambiguous: [],
    exclude: ['nikola tesla', 'tesla coil'],
  },
  MSFT: { names: ['msft', 'microsoft'], ambiguous: [], exclude: [] },
  AMZN: {
    names: ['amzn', 'amazon com', 'amazon web services'],
    ambiguous: ['amazon'],
    exclude: ['amazon rainforest', 'amazon river', 'amazon basin'],
  },

  SHEL: {
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
  HSBA: { names: ['hsba', 'hsbc'], ambiguous: [], exclude: [] },
  VOD: {
    names: ['vodafone group', 'vodafone plc', 'vod l'],
    ambiguous: ['vodafone'],
    // Vodafone Idea is separately listed on the NSE. A story about it is not a
    // story about Vodafone Group plc, however the two are related.
    exclude: ['vodafone idea', 'vi ltd'],
  },

  RELIANCE: {
    names: ['reliance industries', 'reliance jio', 'ril'],
    ambiguous: ['reliance'],
    exclude: ['reliance on', 'self reliance', 'over reliance'],
  },
  TCS: { names: ['tata consultancy', 'tcs'], ambiguous: [], exclude: [] },
  INFY: { names: ['infosys', 'infy'], ambiguous: [], exclude: [] },
};

/** Matching rules for a ticker with no hand-tuned entry: the ticker and the company name. */
export function genericCoverage(symbol: string, name: string): Coverage {
  const company = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/ (inc|corp|corporation|plc|ltd|limited|co|com|group|holdings)$/g, '')
    .trim();
  const ticker = symbol.toLowerCase();
  // A one- or two-letter ticker ("F", "GE") is too common a token to file on.
  const names = [...(ticker.length >= 3 ? [ticker] : []), ...(company ? [company] : [])];
  return { names: [...new Set(names)], ambiguous: [], exclude: [] };
}

/** Rules for a database instrument; tickers like "SHEL.L" use the entry for "SHEL". */
export function coverageFor(symbol: string, name: string): Coverage {
  return COVERAGE[symbol.toUpperCase().split('.')[0]] ?? genericCoverage(symbol, name);
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
export function attribute(item: ScoredNewsItem, covered: readonly CoveredInstrument[]): readonly Attribution[] {
  const text = normalise(`${item.title} ${item.summary ?? ''}`);
  const titleOnly = normalise(item.title);
  const found: Attribution[] = [];

  for (const { id, symbol, coverage } of covered) {
    if (coverage.exclude.some((phrase) => contains(text, phrase))) continue;

    const name = coverage.names.find((phrase) => contains(text, phrase));
    if (name) {
      found.push({ instrumentId: id, symbol, matched: name, basis: 'name' });
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
      instrumentId: id,
      symbol,
      matched: ambiguous,
      basis: 'name+context',
      context,
    });
  }

  return found;
}

export function attributeItem(item: ScoredNewsItem, covered: readonly CoveredInstrument[]): AttributedNewsItem {
  return { ...item, attributions: attribute(item, covered) };
}

/** Keeps only headlines that reached at least one instrument. */
export function attributeAll(
  items: readonly ScoredNewsItem[],
  covered: readonly CoveredInstrument[],
): readonly AttributedNewsItem[] {
  return items.map((item) => attributeItem(item, covered)).filter((item) => item.attributions.length > 0);
}
