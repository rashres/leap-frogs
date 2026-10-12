import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { EMPTY, Subject, catchError, concatMap } from 'rxjs';
import { AccountsService } from '../api/accounts.service';
import type { Instrument } from '../api/models';
import { ActiveAccountService } from './active-account.service';
import { MarketStore } from './market.store';

/** Where the watchlist lived before the API stored it; copied up once, then removed. */
const STORAGE_PREFIX = 'leap.watchlist.';
const LEGACY_KEY = 'leap.watchlist';

/**
 * Starred instrument ids for the active account, stored by the API
 * (GET / PUT /api/accounts/{id}/watchlist). Changes show at once and are saved
 * in the background, one save at a time and in order, so a quick star then
 * unstar cannot land the wrong way round.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly api = inject(AccountsService);
  private readonly market = inject(MarketStore);
  private readonly account = inject(ActiveAccountService);

  private readonly ids = signal<number[]>([]);
  private readonly saves = new Subject<{ accountId: number; ids: number[] }>();

  /** Watched instruments that still exist in the database, in the order they were starred. */
  readonly instruments = computed<Instrument[]>(() => {
    const byId = this.market.byId();
    return this.ids()
      .map((id) => byId.get(id))
      .filter((i): i is Instrument => i !== undefined);
  });

  constructor() {
    effect(() => {
      const accountId = this.account.activeId();
      untracked(() => this.load(accountId));
    });

    this.saves
      .pipe(
        concatMap(({ accountId, ids }) =>
          this.api.saveWatchlist(accountId, ids).pipe(
            // The save did not land: show what the API actually holds.
            catchError(() => {
              this.load(accountId);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

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

  private load(accountId: number | null): void {
    this.ids.set([]);
    if (accountId == null) return;
    this.api.watchlist(accountId).subscribe({
      next: ({ instrumentIds }) => {
        // The user may have switched account while this was in flight.
        if (this.account.activeId() !== accountId) return;
        const local = readStored(accountId);
        if (instrumentIds.length === 0 && local.length > 0) {
          this.ids.set(local);
          this.api.saveWatchlist(accountId, local).subscribe({
            next: (saved) => {
              clearStored(accountId);
              if (this.account.activeId() === accountId) this.ids.set(saved.instrumentIds);
            },
            // Keep the browser copy so the next load can try again.
            error: () => undefined,
          });
        } else {
          this.ids.set(instrumentIds);
        }
      },
      error: () => undefined,
    });
  }

  private persist(): void {
    const accountId = this.account.activeId();
    if (accountId == null) return;
    this.saves.next({ accountId, ids: this.ids() });
  }
}

/** A watchlist this browser kept before the API stored them, or []. */
function readStored(accountId: number): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + accountId) ?? localStorage.getItem(LEGACY_KEY);
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((x): x is number => typeof x === 'number'))] : [];
  } catch {
    return [];
  }
}

function clearStored(accountId: number): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + accountId);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
