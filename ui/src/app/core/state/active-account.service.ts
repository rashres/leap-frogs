import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountsService } from '../api/accounts.service';
import { ApiError, toApiError } from '../api/api-error';
import type { Account } from '../api/models';
import { OrdersService } from '../api/orders.service';

const STORAGE_KEY = 'leap.console.accountId';

/**
 * The account the console is acting as. Stands in for sign-in until the API has
 * authentication: pick an account in the header and every page uses it.
 * Also owns the shared accounts list, so the header and pages stay in sync
 * (e.g. cash balance after an order).
 */
@Injectable({ providedIn: 'root' })
export class ActiveAccountService {
  private readonly accountsApi = inject(AccountsService);
  private readonly orders = inject(OrdersService);

  private readonly selectedId = signal<number | null>(readStoredId());

  readonly accounts = signal<Account[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly active = computed<Account | undefined>(() => {
    const list = this.accounts();
    return list.find((a) => a.accountId === this.selectedId()) ?? list[0];
  });

  readonly activeId = computed(() => this.active()?.accountId ?? null);

  constructor() {
    // Re-read balances whenever an order is placed anywhere in the app.
    effect(() => {
      this.orders.changes();
      this.refresh();
    });
  }

  select(accountId: number): void {
    this.selectedId.set(accountId);
    try {
      localStorage.setItem(STORAGE_KEY, String(accountId));
    } catch {
      /* storage unavailable: selection lasts for this session only */
    }
  }

  refresh(): void {
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
