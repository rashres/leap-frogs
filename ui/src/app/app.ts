import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, tap } from 'rxjs';
import { MARKET_ORDER, marketFor, type MarketPolicy } from './core/markets/sessions';
import { ActiveAccountService } from './core/state/active-account.service';
import { ApiStatusService } from './core/state/api-status.service';
import { MarketStore } from './core/state/market.store';
import { formatTime, formatUsd } from './shared/format';
import { Icon, type IconName } from './shared/icon';

const SIDEBAR_KEY = 'leap.ui.sidebar';
const THEME_KEY = 'leap.ui.theme';

type Theme = 'light' | 'dark';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

const NAV: readonly NavItem[] = [
  { path: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
  { path: '/markets', label: 'Markets', icon: 'markets' },
  { path: '/orders', label: 'Orders', icon: 'orders' },
  { path: '/news', label: 'News', icon: 'news' },
];

/** Shell layout adapted from the team's Angular app (fe/21-page-mascots, app.ts / app.html). */
@Component({
  selector: 'leap-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown.escape)': 'closeOverlays()' },
})
export class App {
  private readonly market = inject(MarketStore);
  private readonly api = inject(ApiStatusService);
  private readonly router = inject(Router);
  protected readonly account = inject(ActiveAccountService);

  readonly nav = NAV;
  readonly menuOpen = signal(false);
  readonly drawerOpen = signal(false);
  readonly collapsed = signal(readStored(SIDEBAR_KEY) === 'collapsed');
  readonly theme = signal<Theme>(document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      tap(() => this.drawerOpen.set(false)),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Section and, for detail routes, the page within it. */
  readonly crumbs = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    if (path.startsWith('/instrument')) return { section: NAV[1], page: 'Instrument' };
    return { section: NAV.find((n) => path.startsWith(n.path)) ?? NAV[0], page: null };
  });

  /** One row per market that has instruments in the database. */
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

  toggleSidebar(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    writeStored(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
  }

  toggleTheme(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    if (next === 'dark') document.documentElement.dataset['theme'] = 'dark';
    else delete document.documentElement.dataset['theme'];
    writeStored(THEME_KEY, next);
  }

  closeOverlays(): void {
    this.menuOpen.set(false);
    this.drawerOpen.set(false);
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

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage disabled: the preference just lasts for this visit. */
  }
}
