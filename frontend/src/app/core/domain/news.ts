/**
 * News and headline sentiment types.
 *
 * NOT A REQUIREMENT FROM THE SPEC. There is no US or BR behind news or
 * sentiment. It exists as the additional capability that section 4.1 asks the
 * author to propose and justify, and it was proposed by the project author, not
 * generated. Recorded as such in docs/traceability.md and docs/open-questions.md
 * OQ-11 so it is never mistaken for delivered scope.
 *
 * [4.1]
 */

/** Which upstream a headline came from. Shown in the UI, never inferred. */
export type NewsSourceId = 'newsapi' | 'yahoo';

export interface NewsItem {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly link: string;
  readonly publishedAt: Date;
  /**
   * Tickers the FEED claims the story is about.
   *
   * Yahoo supplies these; NewsAPI does not, and neither is trusted for the
   * stock board. Attribution to an instrument is done locally and visibly —
   * see `Attribution` and core/data/news-attribution.ts.
   */
  readonly relatedTickers: readonly string[];
  /** One-line summary from the feed, when it provides one. */
  readonly summary?: string;
  readonly source?: NewsSourceId;
}

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

/** A lexicon term found in a headline, and whether a negator flipped it. */
export interface MatchedTerm {
  readonly term: string;
  /** Polarity after negation is applied — what actually counted. */
  readonly polarity: 'positive' | 'negative';
  readonly negated: boolean;
}

/**
 * The result of scoring one headline.
 *
 * `net` is a count of matched terms, not a probability and not a confidence.
 * It is deliberately not normalised into a percentage: a percentage would imply
 * a precision this method does not have.
 */
export interface SentimentScore {
  readonly label: SentimentLabel;
  readonly net: number;
  readonly positives: number;
  readonly negatives: number;
  readonly matched: readonly MatchedTerm[];
}

/** A headline with its score attached. */
export interface ScoredNewsItem extends NewsItem {
  readonly sentiment: SentimentScore;
}

/** Counts across a set of headlines. Counts, never an aggregate percentage. */
export interface SentimentSummary {
  readonly positive: number;
  readonly neutral: number;
  readonly negative: number;
  readonly total: number;
}

/**
 * Why a headline was filed under an instrument.
 *
 * Recorded per match rather than reduced to a boolean, because the reader is
 * shown it. "Filed under SHEL because the title says 'shell' and 'shares'" is
 * checkable in a second; "filed under SHEL" is something you have to trust.
 */
export interface Attribution {
  readonly instrumentId: string;
  readonly symbol: string;
  /** The name or ticker phrase found in the headline. */
  readonly matched: string;
  /**
   * `name` — an unambiguous company name or ticker was present.
   * `name+context` — an ambiguous word ("apple", "shell", "reliance") was
   * present and a corroborating market term confirmed it.
   */
  readonly basis: 'name' | 'name+context';
  /** The corroborating market term, when `basis` is `name+context`. */
  readonly context?: string;
}

/** A headline with its attributions attached. */
export interface AttributedNewsItem extends ScoredNewsItem {
  readonly attributions: readonly Attribution[];
}

/**
 * One instrument's headline sentiment over the sweep window.
 *
 * `net` is positive headline count minus negative headline count. It is a count
 * of headlines, not a strength, not a probability, and not a signal. An
 * instrument with no attributed headlines is reported as such rather than as
 * neutral: silence and balance are different things and must not look alike.
 */
export interface StockSentiment {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly name: string;
  readonly counts: SentimentSummary;
  readonly net: number;
  /** Most recent attributed headline, for the board row. */
  readonly latest: AttributedNewsItem | null;
  readonly items: readonly AttributedNewsItem[];
}
