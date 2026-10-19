import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Account } from './models';

@Injectable({ providedIn: 'root' })
export class OpsService {
  private readonly http = inject(HttpClient);

  search(q = '', status = ''): Observable<Account[]> {
    const params: Record<string, string> = {};
    if (q) params['q'] = q;
    if (status) params['status'] = status;
    return this.http.get<Account[]>('/api/ops/accounts', { params });
  }

  freeze(accountId: number, reason: string): Observable<Account> {
    return this.http.post<Account>(`/api/ops/accounts/${accountId}/freeze`, { reason });
  }

  unfreeze(accountId: number): Observable<Account> {
    return this.http.post<Account>(`/api/ops/accounts/${accountId}/unfreeze`, {});
  }

  statusEvents(accountId: number): Observable<readonly Record<string, unknown>[]> {
    return this.http.get<readonly Record<string, unknown>[]>(`/api/ops/accounts/${accountId}/status-events`);
  }
}
