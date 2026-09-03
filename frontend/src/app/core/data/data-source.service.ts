/**
 * Which quote provider is active.
 *
 * Defaults to live (yfinance-backed) prices now that a local market-data
 * service backs it (backend/main.py). Every unit test still injects
 * MarketDataService directly and never goes through this default, so
 * determinism in tests is unaffected — this only changes what a person sees
 * on first load. A client can still switch back to Fixture from the nav.
 *
 * [US-15]
 */

import { Injectable, signal } from '@angular/core';
import type { DataSourceId } from './quote-provider';

const STORAGE_KEY = 'leap.dataSource';

@Injectable({ providedIn: 'root' })
export class DataSourceService {
  readonly active = signal<DataSourceId>(this.read());

  select(id: DataSourceId): void {
    this.active.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable — selection stays in memory for this session */
    }
  }

  toggle(): void {
    this.select(this.active() === 'fixture' ? 'yahoo' : 'fixture');
  }

  private read(): DataSourceId {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'fixture' ? 'fixture' : 'yahoo';
    } catch {
      return 'yahoo';
    }
  }
}
