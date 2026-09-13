/**
 * Deterministic fixture provider — the default source.
 *
 * This is the behaviour PS-04 asked for: seeded, repeatable, offline, and
 * identical on every reload, which is what lets the execution tests assert
 * exact numbers. It holds the random walk that used to live inside
 * MarketDataService; nothing about the pricing behaviour changed in the move.
 *
 * [US-15]
 */

import { Injectable } from '@angular/core';
import { Decimal } from '../money/decimal';
import { policyFor } from '../domain/instrument';
import {
  seriesEndingAt,
  tickGenerator,
  type ChartRange,
  type FixtureInstrument,
  type PricePoint,
} from './fixtures';
import type { ProviderQuote, QuoteProvider } from './quote-provider';

interface WalkState {
  readonly instrument: FixtureInstrument;
  rate: Decimal;
  readonly previousClose: Decimal;
  readonly nextTick: () => number;
}

@Injectable({ providedIn: 'root' })
export class FixtureQuoteProvider implements QuoteProvider {
  readonly id = 'fixture' as const;
  readonly label = 'Fixture';
  readonly pollMs = 1_800;

  private readonly walk = new Map<string, WalkState>();

  /**
   * Seeds every instrument's opening state. Synchronous by design: the app must
   * be able to render a full page of prices on the very first frame, before any
   * asynchronous source has had a chance to answer.
   */
  seed(instruments: readonly FixtureInstrument[]): readonly ProviderQuote[] {
    for (const instrument of instruments) {
      if (this.walk.has(instrument.id)) continue;

      const scale = instrument.priceScale ?? policyFor(instrument.classCode).priceScale;
      const previousClose = Decimal.parse(instrument.seedPrice).rescale(scale, 'HALF_EVEN');
      const nextTick = tickGenerator(instrument.id);

      // Deterministic opening gap so the day-change column is not all zeroes.
      const openingBp = BigInt((nextTick() % (2 * instrument.volatilityBp + 1)) - instrument.volatilityBp);
      const opened = Decimal.ofUnscaled(
        previousClose.unscaled + (previousClose.unscaled * openingBp) / 10_000n,
        scale,
      );

      this.walk.set(instrument.id, { instrument, rate: opened, previousClose, nextTick });
    }
    return this.current();
  }

  /** Advances every walk one step and returns the new observations. */
  async refresh(instruments: readonly FixtureInstrument[]): Promise<readonly ProviderQuote[]> {
    this.seed(instruments);
    for (const state of this.walk.values()) {
      // Integer basis-point move; a fifth of the per-step volatility per tick.
      const swing = Math.max(2, Math.round(state.instrument.volatilityBp / 5));
      const bp = BigInt((state.nextTick() % (2 * swing + 1)) - swing);
      const delta = (state.rate.unscaled * bp) / 10_000n;
      const moved = state.rate.unscaled + delta;
      state.rate = Decimal.ofUnscaled(moved < 1n ? 1n : moved, state.rate.scale);
    }
    return this.current();
  }

  /** Null: the caller synthesises a series ending at the live rate. */
  async history(): Promise<readonly PricePoint[] | null> {
    return null;
  }

  /**
   * Synthesises a chart series ending exactly at `currentRate`, so the
   * right-hand edge of every chart agrees with the price beside it.
   */
  synthesise(instrument: FixtureInstrument, range: ChartRange, currentRate: Decimal): PricePoint[] {
    return seriesEndingAt(currentRate, range, instrument.volatilityBp, instrument.id);
  }

  private current(): readonly ProviderQuote[] {
    return [...this.walk.values()].map((state) => ({
      instrumentId: state.instrument.id,
      rate: state.rate,
      previousClose: state.previousClose,
      currency: state.instrument.currency,
      observedAt: new Date(),
    }));
  }
}
