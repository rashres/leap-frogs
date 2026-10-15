/**
 * Today's minute-by-minute prices for the live 1D charts, from Yahoo's chart
 * feed through the API's /api/yahoo endpoint (cached there for a few seconds).
 *
 * Prices are converted to USD the way etl/price_fetcher.py does it: pence to
 * pounds, then the latest <CCY>USD=X rate, so the line matches lastPrice.
 */

import { Injectable } from '@angular/core';
import type { PricePoint } from '../../shared/price-chart';

const PROXY = '/api/yahoo';
const RATE_FRESH_MS = 10 * 60_000;
const MINOR_UNITS: Readonly<Record<string, readonly [string, number]>> = { GBp: ['GBP', 100], GBX: ['GBP', 100], ZAc: ['ZAR', 100] };

export interface IntradaySeries {
  /** USD prices, oldest first. */
  readonly points: readonly PricePoint[];
  /** Yesterday's close in USD, the level the day's change is measured from. */
  readonly previousClose: number | null;
  /** The trading session the points belong to. */
  readonly start: Date;
  readonly end: Date;
}

interface ChartResult {
  readonly meta?: {
    readonly currency?: string;
    readonly regularMarketPrice?: number;
    readonly regularMarketTime?: number;
    readonly chartPreviousClose?: number;
    readonly previousClose?: number;
    readonly currentTradingPeriod?: { readonly regular?: { readonly start: number; readonly end: number } };
  };
  readonly timestamp?: readonly number[];
  readonly indicators?: { readonly quote?: readonly { readonly close?: readonly (number | null)[] }[] };
}

@Injectable({ providedIn: 'root' })
export class IntradayService {
  private readonly rates = new Map<string, { at: number; factor: Promise<number | null> }>();

  /** Null when Yahoo has no intraday data for the symbol or its currency cannot be converted. */
  async series(symbol: string): Promise<IntradaySeries | null> {
    const result = await chart(symbol, '1m');
    const meta = result?.meta;
    if (!result || !meta) return null;
    const factor = await this.usdFactor(meta.currency);
    if (factor == null) return null;

    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const points: PricePoint[] = [];
    (result.timestamp ?? []).forEach((t, i) => {
      const close = closes[i];
      if (close != null) points.push({ at: new Date(t * 1000), price: close * factor });
    });
    if (!points.length) return null;

    // Yahoo moves the regular period to the next session once today's has ended.
    const regular = meta.currentTradingPeriod?.regular;
    let start = regular ? regular.start * 1000 : points[0].at.getTime();
    let end = regular ? regular.end * 1000 : points[points.length - 1].at.getTime();
    if (points[points.length - 1].at.getTime() < start) {
      const length = end - start;
      start = points[0].at.getTime();
      end = start + length;
    }

    const latestAt = (meta.regularMarketTime ?? 0) * 1000;
    if (meta.regularMarketPrice != null && latestAt > points[points.length - 1].at.getTime() && latestAt <= end) {
      points.push({ at: new Date(latestAt), price: meta.regularMarketPrice * factor });
    }

    const previous = meta.chartPreviousClose ?? meta.previousClose;
    return {
      points,
      previousClose: previous != null ? previous * factor : null,
      start: new Date(start),
      end: new Date(end),
    };
  }

  /** Multiplier from a Yahoo currency code to USD. */
  private usdFactor(currency: string | undefined): Promise<number | null> {
    if (!currency || currency === 'USD') return Promise.resolve(1);
    const [major, divisor] = MINOR_UNITS[currency] ?? [currency.toUpperCase(), 1];
    if (major === 'USD') return Promise.resolve(1 / divisor);
    const cached = this.rates.get(major);
    if (!cached || Date.now() - cached.at > RATE_FRESH_MS) {
      const factor = chart(`${major}USD=X`, '1d').then((r) => r?.meta?.regularMarketPrice ?? null);
      this.rates.set(major, { at: Date.now(), factor });
    }
    return this.rates.get(major)!.factor.then((rate) => (rate != null ? rate / divisor : null));
  }
}

async function chart(symbol: string, interval: '1m' | '1d'): Promise<ChartResult | null> {
  try {
    const response = await fetch(`${PROXY}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=${interval}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { chart?: { result?: ChartResult[] } };
    return body.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * A portfolio's value through the day: cash plus each holding at its latest
 * price at that minute. Before a holding's first trade of the day, its
 * previous close is used. Today's orders are not replayed: the current
 * quantities are valued across the whole session.
 */
export function portfolioIntraday(
  holdings: readonly { readonly quantity: number; readonly series: IntradaySeries }[],
  cash: number,
): IntradaySeries | null {
  if (!holdings.length) return null;
  const times = [...new Set(holdings.flatMap((h) => h.series.points.map((p) => p.at.getTime())))].sort((a, b) => a - b);
  const cursor = holdings.map(() => -1);
  const points: PricePoint[] = times.map((t) => {
    let value = cash;
    holdings.forEach((h, i) => {
      const pts = h.series.points;
      while (cursor[i] + 1 < pts.length && pts[cursor[i] + 1].at.getTime() <= t) cursor[i]++;
      const price = cursor[i] >= 0 ? pts[cursor[i]].price : (h.series.previousClose ?? pts[0].price);
      value += h.quantity * price;
    });
    return { at: new Date(t), price: value };
  });

  const previous = holdings.reduce((sum, h) => sum + h.quantity * (h.series.previousClose ?? h.series.points[0].price), cash);
  return {
    points,
    previousClose: previous,
    start: new Date(Math.min(...holdings.map((h) => h.series.start.getTime()))),
    end: new Date(Math.max(...holdings.map((h) => h.series.end.getTime()))),
  };
}
