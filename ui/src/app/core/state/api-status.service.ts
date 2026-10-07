import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ApiError } from '../api/api-error';
import type { Health } from '../api/models';
import { SystemService } from '../api/system.service';

export type ApiStatus = 'checking' | 'up' | 'db-down' | 'unreachable';

const POLL_MS = 30_000;

/** Polls GET /api/health so the header can show whether the API and database are up. */
@Injectable({ providedIn: 'root' })
export class ApiStatusService {
  private readonly system = inject(SystemService);

  readonly status = signal<ApiStatus>('checking');
  readonly lastHealth = signal<Health | null>(null);
  readonly checkedAt = signal<Date | null>(null);

  constructor() {
    this.check();
    const timer = setInterval(() => this.check(), POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  check(): void {
    this.system.health().subscribe({
      next: (health) => this.record(health),
      error: (error: unknown) => {
        // 503 still carries a Health body: the API is up but the database is not.
        if (error instanceof ApiError && error.status === 503 && isHealth(error.body)) {
          this.record(error.body);
        } else {
          this.lastHealth.set(null);
          this.status.set('unreachable');
          this.checkedAt.set(new Date());
        }
      },
    });
  }

  private record(health: Health): void {
    this.lastHealth.set(health);
    this.status.set(health.database === 'UP' ? 'up' : 'db-down');
    this.checkedAt.set(new Date());
  }
}

function isHealth(body: unknown): body is Health {
  return typeof body === 'object' && body !== null && 'database' in body;
}
