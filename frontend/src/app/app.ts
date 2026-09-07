/**
 * Application shell: top navigation, market session strip, working-order badge.
 *
 * [chore]
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { INSTRUMENT_CLASS_POLICIES, type InstrumentClassCode } from './core/domain/instrument';
import { MarketDataService } from './core/data/market-data.service';
import { OrderService } from './core/data/order.service';
import { DemoStore } from './core/data/persistence';
import { DataSourceService } from './core/data/data-source.service';
import { DEMO_CLIENT_NAME } from './core/data/fixtures';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly market = inject(MarketDataService);
  private readonly orders = inject(OrderService);
  private readonly store = inject(DemoStore);
  private readonly source = inject(DataSourceService);

  readonly clientName = DEMO_CLIENT_NAME;
  readonly initials = DEMO_CLIENT_NAME.split(' ')
    .map((part) => part[0])
    .join('');

  readonly workingCount = computed(() => this.orders.workingOrders().length);

  /** Live open/closed state per instrument class, recomputed on every tick. */
  readonly sessions = computed(() => {
    this.market.lastTickAt();
    const now = new Date();
    return (Object.keys(INSTRUMENT_CLASS_POLICIES) as InstrumentClassCode[]).map((code) => {
      const policy = INSTRUMENT_CLASS_POLICIES[code];
      return { code, label: policy.shortLabel, open: policy.isMarketOpen(now), hours: policy.sessionLabel };
    });
  });

  readonly clock = computed(() =>
    this.market.lastTickAt().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );

  readonly menuOpen = signal(false);

  // ---- Data source [US-15] -------------------------------------------------

  readonly live = computed(() => this.source.active() === 'yahoo');
  readonly status = computed(() => this.market.status());
  readonly statusDetail = computed(() => this.market.statusDetail());

  readonly sourceLabel = computed(() => {
    switch (this.status()) {
      case 'live':
        return 'Live';
      case 'loading':
        return 'Connecting';
      case 'degraded':
        return 'Live (stale)';
      default:
        return 'Fixture';
    }
  });

  readonly sourceTitle = computed(() =>
    this.live()
      ? `Live prices from Yahoo Finance via the dev proxy. ${this.statusDetail() ?? ''} Click to return to deterministic fixtures.`
      : 'Deterministic fixture prices — the default, and what every test runs against. Click for live data.',
  );

  toggleSource(): void {
    this.source.toggle();
  }

  /** Clears saved demo state and reseeds from fixtures. See persistence.ts. */
  resetDemo(): void {
    this.store.reset();
  }
}
