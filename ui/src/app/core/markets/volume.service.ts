/**
 * Today's trading volume per symbol, from Yahoo's chart feed.
 *
 * The LEAP API records prices only, so volume comes from Yahoo through the
 * API's /api/yahoo endpoints, which also serve news and instrument search. Instrument
 * symbols are already Yahoo tickers. Stocks report shares traded; crypto
 * reports the traded value in its quote currency.
 */

import { Injectable, signal } from '@angular/core';

const PROXY = '/api/yahoo';
const FRESH_MS = 5 * 60_000;

export interface Volume {
  readonly value: number;
  /** True when Yahoo reports value traded (crypto) rather than units. */
  readonly isValue: boolean;
}

interface ChartMeta {
  readonly regularMarketVolume?: number;
  readonly instrumentType?: string;
}

@Injectable({ providedIn: 'root' })
export class VolumeService {
  private readonly cache = signal<ReadonlyMap<string, Volume | null>>(new Map());
  private readonly fetchedAt = new Map<string, number>();

  /** Null while unknown, or when Yahoo has no volume for the symbol (FX). */
  get(symbol: string): Volume | null {
    return this.cache().get(symbol) ?? null;
  }

  /** Fetches symbols not refreshed in the last few minutes. A failure keeps the last known value and waits for the next window. */
  load(symbols: readonly string[]): void {
    const now = Date.now();
    const due = symbols.filter((s) => now - (this.fetchedAt.get(s) ?? 0) > FRESH_MS);
    for (const symbol of due) {
      this.fetchedAt.set(symbol, now);
      this.fetchOne(symbol).then((volume) => this.cache.update((m) => new Map(m).set(symbol, volume)));
    }
  }

  private async fetchOne(symbol: string): Promise<Volume | null> {
    try {
      const response = await fetch(`${PROXY}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`);
      if (!response.ok) return this.get(symbol);
      const body = (await response.json()) as { chart?: { result?: { meta?: ChartMeta }[] } };
      const meta = body.chart?.result?.[0]?.meta;
      const value = meta?.regularMarketVolume;
      if (!value) return null;
      return { value, isValue: meta?.instrumentType === 'CRYPTOCURRENCY' };
    } catch {
      return this.get(symbol);
    }
  }
}
