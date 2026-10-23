import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, tap } from 'rxjs';
import { DISPLAY_ZONE, DISPLAY_ZONE_LABEL, MARKET_ORDER, marketFor, type MarketPolicy } from './core/markets/sessions';
import { ActiveAccountService } from './core/state/active-account.service';
import { ApiStatusService } from './core/state/api-status.service';
import { MarketStore } from './core/state/market.store';
import { AuthService, type AppRole } from './core/api/auth.service';
import { ThemeService } from './core/state/theme.service';
import { I18nService, fill } from './core/i18n/i18n.service';
import { SHELL_TEXT, type ShellText } from './core/i18n/shell.i18n';
import { formatTime, formatUsd } from './shared/format';
import { DisplayControls } from './shared/display-controls';
import { Icon, type IconName } from './shared/icon';

const SIDEBAR_KEY = 'leap.ui.sidebar';

interface NavItem {
  readonly path: string;
  readonly key: keyof ShellText['nav'];
  readonly label: string;
  readonly icon: IconName;
  readonly roles: readonly AppRole[];
}

const NAV: readonly Omit<NavItem, 'label'>[] = [
  { path: '/portfolio', key: 'portfolio', icon: 'portfolio', roles: ['SUPER_ADMIN', 'TRADER'] },
  { path: '/markets', key: 'markets', icon: 'markets', roles: ['SUPER_ADMIN', 'TRADER'] },
  { path: '/orders', key: 'orders', icon: 'orders', roles: ['SUPER_ADMIN', 'TRADER'] },
  { path: '/copy-trading', key: 'copyTrading', icon: 'copy', roles: ['SUPER_ADMIN', 'TRADER'] },
  { path: '/news', key: 'news', icon: 'news', roles: ['SUPER_ADMIN', 'TRADER'] },
  { path: '/ops', key: 'operations', icon: 'activity', roles: ['SUPER_ADMIN', 'TRADING_OPERATIONS'] },
  { path: '/ops/accounts', key: 'accounts', icon: 'users', roles: ['SUPER_ADMIN', 'TRADING_OPERATIONS'] },
  { path: '/audit', key: 'audit', icon: 'shield-check', roles: ['SUPER_ADMIN', 'TRADING_OPERATIONS'] },
  { path: '/analytics', key: 'analytics', icon: 'analytics', roles: ['SUPER_ADMIN', 'BUSINESS_ANALYST'] },
];

/** Shell layout adapted from the team's Angular app (fe/21-page-mascots, app.ts / app.html). */
@Component({
  selector: 'leap-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, Icon, DisplayControls],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown.escape)': 'closeOverlays()' },
})
export class App {
  private readonly market = inject(MarketStore);
  private readonly api = inject(ApiStatusService);
  private readonly router = inject(Router);
  private readonly themes = inject(ThemeService);
  protected readonly account = inject(ActiveAccountService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  /** Shell words in the chosen language. */
  readonly t = computed(() => SHELL_TEXT[this.i18n.lang()]);

  readonly nav = computed<NavItem[]>(() => {
    const role = this.auth.role();
    if (!role) return [];
    const words = this.t().nav;
    return NAV.filter((n) => n.roles.includes(role)).map((n) => ({ ...n, label: words[n.key] }));
  });
  readonly menuOpen = signal(false);
  readonly drawerOpen = signal(false);
  readonly collapsed = signal(readStored(SIDEBAR_KEY) === 'collapsed');
  readonly theme = this.themes.theme;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      tap(() => this.drawerOpen.set(false)),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Full-bleed auth pages sit outside the console shell. */
  readonly authRoute = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    return path === '/login' || path === '/admin/login' || path === '/signup';
  });

  /** Section and, for detail routes, the page within it. */
  readonly crumbs = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    const items = this.nav();
    const fallback: NavItem = { path: '/', key: 'portfolio', label: 'LilyPad', icon: 'portfolio', roles: [] };
    const page = this.t().page;
    const pick = (...candidates: Array<NavItem | undefined>) =>
      candidates.find((n) => n != null) ?? fallback;
    if (path.startsWith('/instrument')) {
      return { section: pick(items.find((n) => n.path === '/markets'), items[0]), page: page.instrument };
    }
    if (path.startsWith('/copy-trading/')) {
      return { section: pick(items.find((n) => n.path === '/copy-trading'), items[0]), page: page.leadTrader };
    }
    if (path.startsWith('/ops/accounts/')) {
      return { section: pick(items.find((n) => n.path === '/ops/accounts'), items[0]), page: page.inspect };
    }
    return {
      section: pick(
        items.find((n) => path === n.path || path.startsWith(n.path + '/')),
        items[0],
      ),
      page: null,
    };
  });

  readonly showAccountPicker = computed(() => this.auth.canPickAccount());
  readonly userLabel = computed(() => this.auth.me()?.displayName ?? this.account.active()?.name);

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
    `${this.market.now().toLocaleTimeString('en-US', { timeZone: DISPLAY_ZONE, hour: 'numeric', minute: '2-digit', second: '2-digit' })} ${DISPLAY_ZONE_LABEL}`,
  );

  /** Header pill: is the API up, and is the price feed filling instrument.last_price. */
  readonly source = computed(() => {
    const words = this.t().source;
    switch (this.api.status()) {
      case 'checking':
        return { label: words.checking, tone: '', title: 'Checking GET /api/health…' };
      case 'unreachable':
        return { label: words.offline, tone: 'bad', title: 'The API is not reachable. Is Spring Boot running on port 8081?' };
      case 'db-down':
        return { label: words.dbDown, tone: 'bad', title: 'The API is up but cannot reach the database.' };
    }
    if (!this.market.hasPrices()) {
      return {
        label: words.noPrices,
        tone: 'bad',
        title: 'API online, but no instrument has a lastPrice yet. Prices come from the yfinance price fetcher.',
      };
    }
    const updated = this.market.lastPriceUpdate();
    return {
      label: words.live,
      tone: 'on',
      title: `API online. Latest price update ${updated ? formatTime(updated) : 'unknown'}. Click to refresh.`,
    };
  });

  readonly initials = computed(() => initialsOf(this.userLabel()));
  readonly roleLabel = computed(() => {
    const role = this.auth.me()?.role;
    return role ? this.t().roles[role] : null;
  });

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
    this.themes.toggle();
  }

  closeOverlays(): void {
    this.menuOpen.set(false);
    this.drawerOpen.set(false);
  }

  apiLabel(label: string): string {
    return fill(this.t().apiStatus, { label });
  }

  signedInAs(who: string): string {
    return fill(this.t().signedInAs, { who });
  }

  signOut(): void {
    this.menuOpen.set(false);
    this.auth.logout().subscribe();
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
