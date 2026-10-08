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
    this.persist();
  }

  /** Adds an instrument, optionally at a position (used to undo a removal in place). */
  add(id: number, at?: number): void {
    if (this.isWatched(id)) return;
    this.ids.update((ids) => {
      const next = [...ids];
      next.splice(at ?? next.length, 0, id);
      return next;
    });
    this.persist();
  }

  /** Removes an instrument and returns the position it had, or -1 if it was not watched. */
  remove(id: number): number {
    const index = this.ids().indexOf(id);
    if (index < 0) return -1;
    this.ids.update((ids) => ids.filter((x) => x !== id));
    this.persist();
    return index;
  }

  private persist(): void {
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
