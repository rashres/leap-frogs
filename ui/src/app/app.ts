import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MARKET_ORDER, marketFor, type MarketPolicy } from './core/markets/sessions';
import { ActiveAccountService } from './core/state/active-account.service';
import { ApiStatusService } from './core/state/api-status.service';
import { MarketStore } from './core/state/market.store';
import { formatTime, formatUsd } from './shared/format';

/** Shell layout adapted from the team's Angular app (fe/21-page-mascots, app.ts / app.html). */
@Component({
  selector: 'leap-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class App {
  private readonly market = inject(MarketStore);
  private readonly api = inject(ApiStatusService);
  protected readonly account = inject(ActiveAccountService);

  readonly menuOpen = signal(false);

  /** One dot per market that has instruments in the database. */
  readonly sessions = computed(() => {
    const now = this.market.now();
    const present = new Set<MarketPolicy>();
    for (const instrument of this.market.instruments()) {
      const market = marketFor(instrument.exchange);
      if (market) present.add(market);
    }
    return MARKET_ORDER.flatMap((code) => [...present].filter((m) => m.code === code)).map((m) => ({
      code: m.code,
      label: m.shortLabel,
      open: m.isOpen(now),
      hours: m.sessionLabel,
    }));
  });

  readonly clock = computed(() =>
    this.market.now().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );

  /** Header pill: is the API up, and is the price feed filling instrument.last_price. */
  readonly source = computed(() => {
    switch (this.api.status()) {
      case 'checking':
        return { label: 'Connecting', tone: '', title: 'Checking GET /api/health…' };
      case 'unreachable':
        return { label: 'Offline', tone: 'bad', title: 'The API is not reachable. Is Spring Boot running on port 8081?' };
      case 'db-down':
        return { label: 'DB down', tone: 'bad', title: 'The API is up but cannot reach the database.' };
    }
    if (!this.market.hasPrices()) {
      return {
        label: 'No prices',
        tone: 'bad',
        title: 'API online, but no instrument has a lastPrice yet. Prices come from the yfinance price fetcher.',
      };
    }
    const updated = this.market.lastPriceUpdate();
    return {
      label: 'Live',
      tone: 'on',
      title: `API online. Latest price update ${updated ? formatTime(updated) : 'unknown'}. Click to refresh.`,
    };
  });

  readonly initials = computed(() => initialsOf(this.account.active()?.name));

  readonly accountRows = computed(() =>
    this.account.accounts().map((a) => ({
      id: a.accountId,
      name: a.name,
      email: a.email,
      initials: initialsOf(a.name),
      cash: formatUsd(a.cashBalance),
      active: a.accountId === this.account.activeId(),
    })),
  );

  refresh(): void {
    this.api.check();
    this.market.refresh();
    this.account.refresh();
  }

  choose(accountId: number): void {
    this.account.select(accountId);
    this.menuOpen.set(false);
  }
}

function initialsOf(name: string | undefined): string {
  if (!name) return '··';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
