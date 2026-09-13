/**
 * Which quote provider is active.
 *
 * Defaults to fixtures, which need no backend. Live prices come from
 * /api/yahoo, served by backend/main.py through the dev proxy; until that
 * lands, switch this default to 'yahoo'. Every unit test injects
 * MarketDataService directly and never goes through this default, so
 * determinism in tests is unaffected. A client can switch to Live from the nav.
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
      return localStorage.getItem(STORAGE_KEY) === 'yahoo' ? 'yahoo' : 'fixture';
    } catch {
      return 'fixture';
    }
  }
}
