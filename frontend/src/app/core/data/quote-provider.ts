/**
 * The seam between the app and wherever prices come from.
 *
 * Prompt 2 / PS-04 specified a fixture-backed provider and explicitly ruled out
 * a vendor feed, on the grounds that determinism is what makes the execution
 * tests meaningful. That reasoning is preserved rather than overturned: the
 * fixture provider remains the default and backs every test, and a live adapter
 * is an alternative implementation behind this interface, selected at runtime.
 * Swapping the source must never change how an order is priced, validated or
 * recorded — only where the numbers originate.
 *
 * [US-15][US-16]
 */

import type { Decimal } from '../money/decimal';
import type { CurrencyCode } from '../money/currency';
import type { ChartRange, FixtureInstrument, PricePoint } from './fixtures';

export type DataSourceId = 'fixture' | 'yahoo';

/**
 * One observation from a provider.
 *
 * `rate` and `previousClose` are at the INSTRUMENT'S quoting precision, not the
 * currency's minor unit — an FX pair carries 5dp. Conversion to settleable
 * Money happens downstream in MarketDataService.
 */
export interface ProviderQuote {
  readonly instrumentId: string;
  readonly rate: Decimal;
  readonly previousClose: Decimal;
  readonly currency: CurrencyCode;
  readonly observedAt: Date;
}

export interface QuoteProvider {
  readonly id: DataSourceId;
  readonly label: string;
  /** How often MarketDataService should ask for a refresh, in milliseconds. */
  readonly pollMs: number;

  /** Latest observations. Rejecting is allowed; the caller keeps the last good set. */
  refresh(instruments: readonly FixtureInstrument[]): Promise<readonly ProviderQuote[]>;

  /**
   * Historical series for a chart range.
   *
   * Returning null means "no history available from this source" — the caller
   * then synthesises a series ending at the current rate, which is what the
   * fixture provider does.
   */
  history(
    instrument: FixtureInstrument,
    range: ChartRange,
    currentRate: Decimal,
  ): Promise<readonly PricePoint[] | null>;
}
