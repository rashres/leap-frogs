import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CopiedOrder, CopySubscription, CopyTrader, Order } from './models';

@Injectable({ providedIn: 'root' })
export class CopyTradingService {
  private readonly http = inject(HttpClient);

  traders(): Observable<CopyTrader[]> {
    return this.http.get<CopyTrader[]>('/api/copy-traders');
  }

  trader(copyTraderId: number): Observable<CopyTrader> {
    return this.http.get<CopyTrader>(`/api/copy-traders/${copyTraderId}`);
  }

  /** Every filled order of the trader, newest first. */
  traderOrders(copyTraderId: number): Observable<Order[]> {
    return this.http.get<Order[]>(`/api/copy-traders/${copyTraderId}/orders`);
  }

  subscriptions(accountId: number): Observable<CopySubscription[]> {
    return this.http.get<CopySubscription[]>(`/api/accounts/${accountId}/copy-subscriptions`);
  }

  copiedOrders(accountId: number): Observable<CopiedOrder[]> {
    return this.http.get<CopiedOrder[]>(`/api/accounts/${accountId}/copied-orders`);
  }

  /** Starts copying; 400 when the allocation is too large or the trader is already copied. */
  follow(accountId: number, copyTraderId: number, allocation: number): Observable<CopySubscription> {
    return this.http.post<CopySubscription>(`/api/accounts/${accountId}/copy-subscriptions`, { copyTraderId, allocation });
  }

  unfollow(accountId: number, subscriptionId: number): Observable<void> {
    return this.http.delete<void>(`/api/accounts/${accountId}/copy-subscriptions/${subscriptionId}`);
  }
}
