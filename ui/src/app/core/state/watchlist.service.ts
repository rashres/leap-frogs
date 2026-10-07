import { Injectable, computed, inject, signal } from '@angular/core';
import type { Instrument } from '../api/models';
import { MarketStore } from './market.store';

const STORAGE_KEY = 'leap.watchlist';

/** Starred instrument ids, kept in this browser's localStorage. */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly market = inject(MarketStore);
  private readonly ids = signal<number[]>(readStored());

  /** Watched instruments that still exist in the database, in the order they were starred. */
  readonly instruments = computed<Instrument[]>(() => {
    const byId = this.market.byId();
    return this.ids()
      .map((id) => byId.get(id))
      .filter((i): i is Instrument => i !== undefined);
  });

  isWatched(id: number): boolean {
    return this.ids().includes(id);
  }

  toggle(id: number): void {
    this.ids.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids()));
    } catch {
      /* storage unavailable: the watchlist lasts for this session only */
    }
  }
}

function readStored(): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
