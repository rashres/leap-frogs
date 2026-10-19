import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InstrumentsService } from '../../core/api/instruments.service';
import { IntradayService } from '../../core/markets/intraday.service';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import type { PricePoint } from '../../shared/price-chart';

const REFRESH_MS = 60_000;
/** Sparklines only need a coarse path; keeps the SVG light when Yahoo returns hundreds of minutes. */
const SPARK_MAX = 64;

export interface MarketRow {
  readonly id: number;
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly market: string;
  readonly price: number | null;
  readonly reference: number | null;
  /** Day change ending at the live price. Null without a reference and a last price. */
  readonly change: number | null;
  readonly changePct: number | null;
  readonly points: readonly PricePoint[];
  readonly updatedAt: string | null;
}

interface DaySeries {
  readonly points: readonly PricePoint[];
  /** Reference for the day's % — Yahoo previous close when available. */
  readonly reference: number | null;
}

/**
 * Each instrument's day trend for the portfolio overview and ticker belt.
 * Prefers Yahoo's live 1-minute session (same feed as the 1D charts) so the
 * sparkline is useful even when instrument_price has only a few rows.
 * Falls back to GET /api/instruments/{id}/prices?range=1D when Yahoo has nothing.
 * Provided by the portfolio page so polling stops when the page closes.
 */
@Injectable()
export class DayChangeStore {
  private readonly api = inject(InstrumentsService);
  private readonly market = inject(MarketStore);
  private readonly intraday = inject(IntradayService);

  private readonly series = signal<ReadonlyMap<number, DaySeries>>(new Map());
  readonly loaded = signal(false);

  private readonly ids = computed(() => this.market.instruments().map((i) => i.instrumentId).join(','));

  readonly rows = computed<readonly MarketRow[]>(() => {
    const series = this.series();
    return this.market.instruments().map((i) => {
      const day = series.get(i.instrumentId);
      const points = [...(day?.points ?? [])];
      const live = i.lastPrice ?? null;
      if (live != null && i.priceUpdatedAt) {
        const at = new Date(i.priceUpdatedAt);
        if (!points.length || at > points[points.length - 1].at) points.push({ at, price: live });
      }
      const last = live ?? points[points.length - 1]?.price ?? null;
      const reference = day?.reference ?? points[0]?.price ?? null;
      const change = reference != null && last != null && points.length >= 2 ? last - reference : null;
      return {
        id: i.instrumentId,
        symbol: i.symbol,
        name: i.name,
        exchange: i.exchange,
        market: marketFor(i.exchange)?.shortLabel ?? i.exchange,
        price: last,
        reference,
        change,
        changePct: change != null && reference ? (change / reference) * 100 : null,
        points: downsample(points, SPARK_MAX),
        updatedAt: i.priceUpdatedAt ?? null,
      };
    });
  });

  readonly byId = computed(() => new Map(this.rows().map((r) => [r.id, r])));

  constructor() {
    effect(() => {
      if (!this.ids()) return;
      untracked(() => this.load());
    });
    const timer = setInterval(() => this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private load(): void {
    const instruments = this.market.instruments();
    if (!instruments.length) return;
    void Promise.all(instruments.map((i) => this.loadOne(i.instrumentId, i.symbol))).then((entries) => {
      this.series.set(new Map(entries));
      this.loaded.set(true);
    });
  }

  private async loadOne(id: number, symbol: string): Promise<readonly [number, DaySeries]> {
    try {
      const live = await this.intraday.series(symbol);
      if (live && live.points.length >= 2) {
        return [id, { points: live.points, reference: live.previousClose ?? live.points[0].price }];
      }
    } catch {
      /* fall through to recorded history */
    }

    try {
      const pts = await firstValueFrom(this.api.prices(id, '1D'));
      const points = pts.map((p) => ({ at: new Date(p.observedAt), price: p.price }));
      return [id, { points, reference: points[0]?.price ?? null }];
    } catch {
      return [id, { points: [], reference: null }];
    }
  }
}

function downsample(points: readonly PricePoint[], max: number): PricePoint[] {
  if (points.length <= max) return [...points];
  const out: PricePoint[] = [];
  const last = points.length - 1;
  for (let i = 0; i < max; i++) {
    out.push(points[Math.round((i * last) / (max - 1))]!);
  }
  return out;
}
