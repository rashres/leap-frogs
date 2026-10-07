import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Account, Holding, PortfolioValuePointDto, PriceRange } from './models';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Observable<Account[]> {
    return this.http.get<Account[]>('/api/accounts');
  }

  get(accountId: number): Observable<Account> {
    return this.http.get<Account>(`/api/accounts/${accountId}`);
  }

  holdings(accountId: number): Observable<Holding[]> {
    return this.http.get<Holding[]>(`/api/accounts/${accountId}/holdings`);
  }

  valueHistory(accountId: number, range: PriceRange): Observable<PortfolioValuePointDto[]> {
    return this.http.get<PortfolioValuePointDto[]>(`/api/accounts/${accountId}/value-history`, { params: { range } });
  }
}
