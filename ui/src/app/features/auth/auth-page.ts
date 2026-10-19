import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { toApiError } from '../../core/api/api-error';
import { MARKET_ORDER, marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { ThemeService } from '../../core/state/theme.service';
import { formatPrice, formatSignedPct, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { DayChangeStore } from '../portfolio/day-change.store';
import { TickerBelt } from '../portfolio/ticker-belt';

/** Usernames the API accepts: 3 to 32 letters, numbers, dots, dashes or underscores. */
const USERNAME = /^[A-Za-z0-9._-]{3,32}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-in and sign-up page. Sign-in posts to /api/auth/login (or
 * /api/auth/admin/login for Super Admin). Sign-up (route data `signup`) posts
 * to /api/auth/register, which opens a trading account with a TRADER login.
 */
@Component({
  selector: 'leap-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, InstrumentLogo, TickerBelt],
  providers: [DayChangeStore],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly market = inject(MarketStore);
  private readonly dayChange = inject(DayChangeStore);
  private readonly themes = inject(ThemeService);

  readonly theme = this.themes.theme;
  readonly admin = toSignal(this.route.data.pipe(map((d) => !!d['admin'])), { initialValue: false });
  readonly signup = toSignal(this.route.data.pipe(map((d) => !!d['signup'])), { initialValue: false });

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly name = signal('');
  readonly email = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly remember = signal(true);

  readonly title = computed(() =>
    this.signup() ? 'Create Your Account' : this.admin() ? 'Super Admin Sign In' : 'Login to Your Account!',
  );
  readonly submitLabel = computed(() =>
    this.signup() ? 'Create Account' : this.admin() ? 'Sign In as Admin' : 'Login To Your Account',
  );
  readonly busyLabel = computed(() => (this.signup() ? 'Creating account…' : 'Signing in…'));

  readonly demos = computed(() =>
    this.admin()
      ? [{ username: 'admin', label: 'Super Admin' }]
      : [
          { username: 'joanna', label: 'Joanna (Trader)' },
          { username: 'priya', label: 'Priya (Analyst)' },
          { username: 'david', label: 'David (Operations)' },
        ],
  );

  readonly sessions = computed(() => {
    const now = this.market.now();
    const byCode = new Map(
      this.market
        .instruments()
        .map((i) => marketFor(i.exchange))
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map((m) => [m.code, m] as const),
    );
    return MARKET_ORDER.filter((c) => byCode.has(c)).map((c) => {
      const m = byCode.get(c)!;
      return { label: m.shortLabel, open: m.isOpen(now) };
    });
  });

  readonly movers = computed(() =>
    [...this.dayChange.rows()]
      .filter((r) => r.changePct != null)
      .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))
      .slice(0, 3)
      .map((r) => ({
        symbol: r.symbol,
        pct: formatSignedPct(r.changePct),
        up: (r.change ?? 0) >= 0,
      })),
  );

  readonly moverExtra = computed(() => Math.max(0, this.dayChange.rows().filter((r) => r.price != null).length - 3));

  readonly showcase = computed(() => {
    const priced = this.dayChange.rows().filter((r) => r.price != null && r.change != null);
    const sample = priced.slice(0, 5);
    const day = sample.reduce((s, r) => s + (r.changePct ?? 0), 0) / Math.max(sample.length, 1);
    return {
      value: formatUsd(6421.5),
      dayPct: formatSignedPct(day || 1.24),
      dayUp: (day || 1.24) >= 0,
      mask: '•• •••• 3667',
    };
  });

  readonly weekBars = computed(() => {
    const pcts = this.dayChange
      .rows()
      .filter((r) => r.changePct != null)
      .slice(0, 7)
      .map((r) => Math.min(100, Math.abs(r.changePct!) * 18 + 28));
    const defaults = [42, 58, 36, 72, 48, 64, 55];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().getDay();
    const highlight = today === 0 ? 6 : today - 1;
    return days.map((label, i) => ({
      label,
      h: pcts[i] ?? defaults[i]!,
      on: i === highlight,
    }));
  });

  readonly headlineMover = computed(() => {
    const row = [...this.dayChange.rows()]
      .filter((r) => r.price != null)
      .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))[0];
    if (!row) return null;
    return {
      symbol: row.symbol,
      price: formatPrice(row.price),
      pct: formatSignedPct(row.changePct),
      up: (row.change ?? 0) >= 0,
    };
  });

  toggleTheme(): void {
    this.themes.toggle();
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  fillDemo(username: string): void {
    this.username.set(username);
    // Password is not filled from the repo — use LEAP_DEMO_PASSWORD from local .env.
    this.password.set('');
  }

  submit(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    if (this.signup()) {
      this.register();
      return;
    }
    const username = this.username().trim();
    const password = this.password();
    if (!username) {
      this.error.set('Enter your username.');
      return;
    }
    if (password.length < 6) {
      this.error.set('Password needs at least 6 characters.');
      return;
    }
    this.submitting.set(true);
    this.auth.login(username, password, this.admin()).subscribe({
      next: (me) => {
        this.submitting.set(false);
        void this.router.navigateByUrl(me.homePath);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(toApiError(err).message || 'Sign in failed.');
      },
    });
  }

  private register(): void {
    const details = {
      name: this.name().trim(),
      email: this.email().trim(),
      username: this.username().trim(),
      password: this.password(),
    };
    const problem = !details.name
      ? 'Enter your name.'
      : !EMAIL.test(details.email)
        ? 'Enter a valid email address.'
        : !USERNAME.test(details.username)
          ? 'Username must be 3 to 32 letters, numbers, dots, dashes or underscores.'
          : details.password.length < 8
            ? 'Password needs at least 8 characters.'
            : details.password !== this.confirmPassword()
              ? 'The passwords do not match.'
              : null;
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.submitting.set(true);
    this.auth.register(details).subscribe({
      next: (me) => {
        this.submitting.set(false);
        void this.router.navigateByUrl(me.homePath);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const e = toApiError(err);
        const fieldMessage = Object.values(e.fieldErrors)[0];
        this.error.set(fieldMessage || e.message || 'Could not create the account.');
      },
    });
  }
}
