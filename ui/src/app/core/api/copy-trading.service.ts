import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CopiedOrder, CopySettings, CopySubscription, CopyTrader, Holding, Order, PortfolioValuePointDto, PriceRange } from './models';

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

  /** The lead trader's holdings. Public to anyone signed in, unlike /accounts/{id}/holdings. */
  traderHoldings(copyTraderId: number): Observable<Holding[]> {
    return this.http.get<Holding[]>(`/api/copy-traders/${copyTraderId}/holdings`);
  }

  /** The lead trader's value over a range. Public to anyone signed in, unlike /accounts/{id}/value-history. */
  traderValueHistory(copyTraderId: number, range: PriceRange): Observable<PortfolioValuePointDto[]> {
    return this.http.get<PortfolioValuePointDto[]>(`/api/copy-traders/${copyTraderId}/value-history`, { params: { range } });
  }

  subscriptions(accountId: number): Observable<CopySubscription[]> {
    return this.http.get<CopySubscription[]>(`/api/accounts/${accountId}/copy-subscriptions`);
  }

  copiedOrders(accountId: number): Observable<CopiedOrder[]> {
    return this.http.get<CopiedOrder[]>(`/api/accounts/${accountId}/copied-orders`);
  }

  /** Starts copying; 400 when the allocation is too large or the trader is already copied. */
  follow(accountId: number, copyTraderId: number, settings: CopySettings): Observable<CopySubscription> {
    return this.http.post<CopySubscription>(`/api/accounts/${accountId}/copy-subscriptions`, { copyTraderId, ...settings });
  }

  /**
   * Replaces a copy's settings and pause state. 400 when the allocation is too
   * large, or when resuming a copy that is still past its stop-loss.
   */
  updateSettings(accountId: number, subscriptionId: number, settings: CopySettings & { paused: boolean }): Observable<CopySubscription> {
    return this.http.put<CopySubscription>(`/api/accounts/${accountId}/copy-subscriptions/${subscriptionId}`, settings);
  }

  unfollow(accountId: number, subscriptionId: number): Observable<void> {
    return this.http.delete<void>(`/api/accounts/${accountId}/copy-subscriptions/${subscriptionId}`);
  }
}
