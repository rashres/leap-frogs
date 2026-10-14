import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, type Observable } from 'rxjs';

/** Optional report filters; dates are inclusive, yyyy-MM-dd. */
export interface AnalyticsFilter {
  readonly from: string | null;
  readonly to: string | null;
  readonly symbol: string | null;
}

export type AnalyticsInterval = 'day' | 'week' | 'month';

/** GET /api/analytics/summary. Values are USD. */
export interface AnalyticsSummary {
  from: string | null;
  to: string | null;
  trades: number;
  buyTrades: number;
  sellTrades: number;
  valueTraded: number;
  buyValue: number;
  sellValue: number;
  activeClients: number;
  instrumentsTraded: number;
  /** When the ETL last copied trades into the reporting database; null if it never ran. */
  dataAsOf: string | null;
}

/** GET /api/analytics/volume; only periods with trades are returned. */
export interface VolumePoint {
  period: string;
  trades: number;
  buyValue: number;
  sellValue: number;
  valueTraded: number;
}

/** GET /api/analytics/instruments, ranked by value traded. */
export interface InstrumentActivity {
  symbol: string;
  name: string | null;
  exchange: string | null;
  trades: number;
  buyTrades: number;
  sellTrades: number;
  clients: number;
  valueTraded: number;
}

/** GET /api/analytics/markets */
export interface MarketActivity {
  exchange: string;
  trades: number;
  instruments: number;
  valueTraded: number;
}

/** GET /api/analytics/clients */
export interface ClientActivity {
  month: string;
  activeClients: number;
  trades: number;
  valueTraded: number;
  avgTradesPerClient: number;
}

/** Orders by outcome; rates are percentages of all orders, null when there are none. */
export interface OutcomeCounts {
  orders: number;
  filled: number;
  pending: number;
  cancelled: number;
  expired: number;
  rejected: number;
  fillRate: number | null;
  cancelRate: number | null;
}

/** A cancelled or expired order. Carries no account: the dashboard identifies no client. */
export interface ClosedOrder {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  timeInForce: 'DAY' | 'GTC';
  status: 'CANCELLED' | 'EXPIRED';
  quantity: number;
  limitPrice: number | null;
  amount: number;
  placedAt: string;
  closedAt: string | null;
}

/** GET /api/analytics/order-outcomes: every order, not just trades. Dates filter on when an order was placed. */
export interface OrderOutcomes {
  totals: OutcomeCounts;
  instruments: { symbol: string; name: string | null; counts: OutcomeCounts }[];
  recentlyClosed: ClosedOrder[];
}

/** Everything on the analytics page except the chart, which reloads on its own when the interval changes. */
export interface AnalyticsReport {
  summary: AnalyticsSummary;
  instruments: InstrumentActivity[];
  markets: MarketActivity[];
  clients: ClientActivity[];
}

/** Read-only reports from the reporting database (leap_analytics), refreshed by the ETL. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);

  report(filter: AnalyticsFilter): Observable<AnalyticsReport> {
    const params = toParams(filter);
    return forkJoin({
      summary: this.http.get<AnalyticsSummary>('/api/analytics/summary', { params }),
      instruments: this.http.get<InstrumentActivity[]>('/api/analytics/instruments', { params: params.set('limit', 100) }),
      markets: this.http.get<MarketActivity[]>('/api/analytics/markets', { params }),
      clients: this.http.get<ClientActivity[]>('/api/analytics/clients', { params }),
    });
  }

  volume(filter: AnalyticsFilter, interval: AnalyticsInterval): Observable<VolumePoint[]> {
    return this.http.get<VolumePoint[]>('/api/analytics/volume', { params: toParams(filter).set('interval', interval) });
  }

  /** Loaded on its own, so a reporting database the ETL has not yet given fact_orders only blanks this panel. */
  orderOutcomes(filter: AnalyticsFilter, recent = 10): Observable<OrderOutcomes> {
    return this.http.get<OrderOutcomes>('/api/analytics/order-outcomes', { params: toParams(filter).set('recent', recent) });
  }
}

function toParams(filter: AnalyticsFilter): HttpParams {
  let params = new HttpParams();
  if (filter.from) params = params.set('from', filter.from);
  if (filter.to) params = params.set('to', filter.to);
  if (filter.symbol) params = params.set('symbol', filter.symbol);
  return params;
}
