import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { InstrumentsService } from '../../core/api/instruments.service';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import type { PricePoint } from '../../shared/price-chart';

const REFRESH_MS = 60_000;

export interface MarketRow {
  readonly id: number;
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly market: string;
  readonly price: number | null;
  /** Change over the recorded 1D window, ending at the live price. Null without two points. */
  readonly change: number | null;
  readonly changePct: number | null;
  readonly points: readonly PricePoint[];
  readonly updatedAt: string | null;
}

/**
 * Each instrument's last day of recorded prices, from the existing
 * GET /api/instruments/{id}/prices?range=1D, joined to the live price list.
 * Provided by the portfolio page so the polling stops when the page closes.
 */
@Injectable()
export class DayChangeStore {
  private readonly api = inject(InstrumentsService);
  private readonly market = inject(MarketStore);

  private readonly series = signal<ReadonlyMap<number, readonly PricePoint[]>>(new Map());
  readonly loaded = signal(false);

  private readonly ids = computed(() => this.market.instruments().map((i) => i.instrumentId).join(','));

  readonly rows = computed<readonly MarketRow[]>(() => {
    const series = this.series();
    return this.market.instruments().map((i) => {
      const recorded = series.get(i.instrumentId) ?? [];
      const points = [...recorded];
      const live = i.lastPrice ?? null;
      if (live != null && i.priceUpdatedAt) {
        const at = new Date(i.priceUpdatedAt);
        if (!points.length || at > points[points.length - 1].at) points.push({ at, price: live });
      }
      const open = points[0]?.price ?? null;
      const last = live ?? points[points.length - 1]?.price ?? null;
      const change = points.length >= 2 && open && last != null ? last - open : null;
      return {
        id: i.instrumentId,
        symbol: i.symbol,
        name: i.name,
        exchange: i.exchange,
        market: marketFor(i.exchange)?.shortLabel ?? i.exchange,
        price: last,
        change,
        changePct: change != null && open ? (change / open) * 100 : null,
        points,
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
    forkJoin(
      instruments.map((i) =>
        this.api.prices(i.instrumentId, '1D').pipe(
          map((pts) => [i.instrumentId, pts.map((p) => ({ at: new Date(p.observedAt), price: p.price }))] as const),
          catchError(() => of([i.instrumentId, [] as PricePoint[]] as const)),
        ),
      ),
    ).subscribe((entries) => {
      this.series.set(new Map(entries));
      this.loaded.set(true);
    });
  }
}
