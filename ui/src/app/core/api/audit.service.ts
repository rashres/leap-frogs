import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AuditOrderPage, AuditOrderQuery } from './models';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  list(query: AuditOrderQuery = {}): Observable<AuditOrderPage> {
    let params = new HttpParams()
      .set('page', query.page ?? 0)
      .set('size', query.size ?? 25);

    if (query.accountId != null) params = params.set('accountId', query.accountId);
    if (query.startDate) params = params.set('startDate', query.startDate);
    if (query.endDate) params = params.set('endDate', query.endDate);

    return this.http.get<AuditOrderPage>('/api/audit/orders', { params });
  }
}