import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import type { Observable } from 'rxjs';

export type AppRole = 'SUPER_ADMIN' | 'TRADER' | 'BUSINESS_ANALYST' | 'TRADING_OPERATIONS';

export interface Me {
  userId: number;
  username: string;
  displayName: string;
  role: AppRole;
  accountId: number | null;
  homePath: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly meSignal = signal<Me | null>(null);
  private readonly loadedSignal = signal(false);

  readonly me = this.meSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly role = computed(() => this.meSignal()?.role ?? null);
  readonly isAuthenticated = computed(() => this.meSignal() != null);

  /** Load session on app start. */
  bootstrap(): Observable<Me | null> {
    return this.http.get<Me>('/api/auth/me', { withCredentials: true }).pipe(
      tap((me) => {
        this.meSignal.set(me);
        this.loadedSignal.set(true);
      }),
      catchError(() => {
        this.meSignal.set(null);
        this.loadedSignal.set(true);
        return of(null);
      }),
    );
  }

  login(username: string, password: string, admin = false): Observable<Me> {
    const path = admin ? '/api/auth/admin/login' : '/api/auth/login';
    return this.http.post<Me>(path, { username, password }, { withCredentials: true }).pipe(
      tap((me) => {
        this.meSignal.set(me);
        this.loadedSignal.set(true);
      }),
    );
  }

  /** Creates a trader login with a new trading account and signs in. 409 if the username or email is taken. */
  register(details: { name: string; email: string; username: string; password: string }): Observable<Me> {
    return this.http.post<Me>('/api/auth/register', details, { withCredentials: true }).pipe(
      tap((me) => {
        this.meSignal.set(me);
        this.loadedSignal.set(true);
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.meSignal.set(null);
        void this.router.navigateByUrl('/login');
      }),
      map(() => undefined),
      catchError(() => {
        this.meSignal.set(null);
        void this.router.navigateByUrl('/login');
        return of(undefined);
      }),
    );
  }

  canTrade(): boolean {
    const role = this.role();
    return role === 'SUPER_ADMIN' || role === 'TRADER';
  }

  canPickAccount(): boolean {
    return this.role() === 'SUPER_ADMIN';
  }

  canAccessAnalytics(): boolean {
    const role = this.role();
    return role === 'SUPER_ADMIN' || role === 'BUSINESS_ANALYST';
  }

  canAccessAudit(): boolean {
    const role = this.role();
    return role === 'SUPER_ADMIN' || role === 'TRADING_OPERATIONS';
  }

  canAccessOps(): boolean {
    const role = this.role();
    return role === 'SUPER_ADMIN' || role === 'TRADING_OPERATIONS';
  }
}
