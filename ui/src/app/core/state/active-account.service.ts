import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountsService } from '../api/accounts.service';
import { AuthService } from '../api/auth.service';
import { ApiError, toApiError } from '../api/api-error';
import type { Account } from '../api/models';
import { OrdersService } from '../api/orders.service';

const STORAGE_KEY = 'leap.console.accountId';

/**
 * The account the console is acting on.
 * Super Admin may pick any account; traders are locked to their linked account;
 * ops inspects via route params (this service still loads the list for search).
 */
@Injectable({ providedIn: 'root' })
export class ActiveAccountService {
  private readonly accountsApi = inject(AccountsService);
  private readonly orders = inject(OrdersService);
  private readonly auth = inject(AuthService);

  private readonly selectedId = signal<number | null>(readStoredId());

  readonly accounts = signal<Account[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly active = computed<Account | undefined>(() => {
    const list = this.accounts();
    const me = this.auth.me();
    if (me?.role === 'TRADER' && me.accountId != null) {
      return list.find((a) => a.accountId === me.accountId) ?? list[0];
    }
    return list.find((a) => a.accountId === this.selectedId()) ?? list[0];
  });

  readonly activeId = computed(() => this.active()?.accountId ?? null);

  constructor() {
    effect(() => {
      this.orders.changes();
      this.auth.me();
      this.refresh();
    });
  }

  select(accountId: number): void {
    if (!this.auth.canPickAccount()) return;
    this.selectedId.set(accountId);
    try {
      localStorage.setItem(STORAGE_KEY, String(accountId));
    } catch {
      /* storage unavailable */
    }
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) {
      this.accounts.set([]);
      this.loaded.set(true);
      return;
    }
    const me = this.auth.me();
    if (me?.role === 'TRADER' && me.accountId != null) {
      this.accountsApi.get(me.accountId).subscribe({
        next: (account) => {
          this.accounts.set([account]);
          this.selectedId.set(account.accountId);
          this.error.set(null);
          this.loaded.set(true);
        },
        error: (error: unknown) => {
          this.error.set(toApiError(error));
          this.loaded.set(true);
        },
      });
      return;
    }
    if (me?.role === 'BUSINESS_ANALYST') {
      this.accounts.set([]);
      this.loaded.set(true);
      return;
    }
    this.accountsApi.list().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.error.set(null);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.error.set(toApiError(error));
        this.loaded.set(true);
      },
    });
  }
}

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}
