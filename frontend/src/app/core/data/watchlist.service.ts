/**
 * Watchlist.
 *
 * PS-07 / US-26 covers watchlists and price alerts and is a P2 story. Only the
 * watchlist half is built here; price alerts are not started, and no alerting
 * behaviour is implied by this service.
 *
 * [US-26]
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { MarketDataService } from './market-data.service';
import { FIXTURE_WATCHLIST } from './fixtures';

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly market = inject(MarketDataService);

  private readonly ids = signal<readonly string[]>([...FIXTURE_WATCHLIST]);

  readonly instruments = computed(() =>
    this.ids()
      .map((id) => this.market.instrument(id))
      .filter((instrument): instrument is NonNullable<typeof instrument> => instrument !== undefined),
  );

  isWatched(instrumentId: string): boolean {
    return this.ids().includes(instrumentId);
  }

  toggle(instrumentId: string): void {
    this.ids.update((current) =>
      current.includes(instrumentId)
        ? current.filter((id) => id !== instrumentId)
        : [...current, instrumentId],
    );
  }
}
