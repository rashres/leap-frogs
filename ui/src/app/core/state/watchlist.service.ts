import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import type { Instrument } from '../api/models';
import { ActiveAccountService } from './active-account.service';
import { MarketStore } from './market.store';

const STORAGE_PREFIX = 'leap.watchlist.';
/** Pre-per-account key: one list shared by every account. Handed to the first account that loads. */
const LEGACY_KEY = 'leap.watchlist';

/** Starred instrument ids for the active account, kept in this browser's localStorage. */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly market = inject(MarketStore);
  private readonly account = inject(ActiveAccountService);

  /** Reloads from storage whenever the active account changes. */
  private readonly ids = linkedSignal<number | null, number[]>({
    source: this.account.activeId,
    computation: (accountId) => (accountId == null ? [] : readStored(accountId)),
  });

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
    if (this.account.activeId() == null) return;
    this.ids.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    this.persist();
  }

  /** Adds an instrument, optionally at a position (used to undo a removal in place). */
  add(id: number, at?: number): void {
    if (this.account.activeId() == null || this.isWatched(id)) return;
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
    const accountId = this.account.activeId();
    if (accountId == null) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + accountId, JSON.stringify(this.ids()));
    } catch {
      /* storage unavailable: the watchlist lasts for this session only */
    }
  }
}

function readStored(accountId: number): number[] {
  try {
    const key = STORAGE_PREFIX + accountId;
    let raw = localStorage.getItem(key);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy != null) {
      if (raw == null) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
      localStorage.removeItem(LEGACY_KEY);
    }
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
