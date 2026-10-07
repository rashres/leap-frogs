import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ApiError, toApiError } from '../api/api-error';
import { InstrumentsService } from '../api/instruments.service';
import type { Instrument } from '../api/models';

/** The price fetcher refreshes instrument.last_price every few seconds. */
const REFRESH_MS = 10_000;

/**
 * Every instrument from GET /api/instruments, re-read on a timer so lastPrice
 * stays current. Also owns a one-second clock for the header and session dots.
 */
@Injectable({ providedIn: 'root' })
export class MarketStore {
  private readonly api = inject(InstrumentsService);

  readonly instruments = signal<Instrument[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly fetchedAt = signal<Date | null>(null);
  readonly now = signal(new Date());

  readonly byId = computed(() => new Map(this.instruments().map((i) => [i.instrumentId, i])));

  readonly hasPrices = computed(() => this.instruments().some((i) => i.lastPrice != null));

  /** Most recent priceUpdatedAt across all instruments. */
  readonly lastPriceUpdate = computed(() => {
    const times = this.instruments()
      .map((i) => (i.priceUpdatedAt ? Date.parse(i.priceUpdatedAt) : NaN))
      .filter((t) => !Number.isNaN(t));
    return times.length ? new Date(Math.max(...times)) : null;
  });

  constructor() {
    this.refresh();
    const refresh = setInterval(() => this.refresh(), REFRESH_MS);
    const clock = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(refresh);
      clearInterval(clock);
    });
  }

  refresh(): void {
    this.api.list().subscribe({
      next: (instruments) => {
        this.instruments.set(instruments);
        this.error.set(null);
        this.loaded.set(true);
        this.fetchedAt.set(new Date());
      },
      error: (error: unknown) => {
        this.error.set(toApiError(error));
        this.loaded.set(true);
      },
    });
  }

  instrument(id: number): Instrument | undefined {
    return this.byId().get(id);
  }
}
