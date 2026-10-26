import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Account, Holding, PortfolioValuePointDto, PriceRange, Watchlist } from './models';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Account[]> {
    return this.http.get<Account[]>('/api/accounts');
  }

  get(accountId: number): Observable<Account> {
    return this.http.get<Account>(`/api/accounts/${accountId}`);
  }

  /** Adds cash to the account; the response is the account with its new balance. */
  deposit(accountId: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`/api/accounts/${accountId}/deposits`, { amount });
  }

  /** Takes cash out of the account; the response is the account with its new balance. */
  withdraw(accountId: number, amount: number): Observable<Account> {
    return this.http.post<Account>(`/api/accounts/${accountId}/withdrawals`, { amount });
  }

  holdings(accountId: number): Observable<Holding[]> {
    return this.http.get<Holding[]>(`/api/accounts/${accountId}/holdings`);
  }

  valueHistory(accountId: number, range: PriceRange): Observable<PortfolioValuePointDto[]> {
    return this.http.get<PortfolioValuePointDto[]>(`/api/accounts/${accountId}/value-history`, { params: { range } });
  }

  watchlist(accountId: number): Observable<Watchlist> {
    return this.http.get<Watchlist>(`/api/accounts/${accountId}/watchlist`);
  }

  /** Saves the whole watchlist in this order; the response is what the API stored. */
  saveWatchlist(accountId: number, instrumentIds: readonly number[]): Observable<Watchlist> {
    return this.http.put<Watchlist>(`/api/accounts/${accountId}/watchlist`, { instrumentIds });
  }
}
