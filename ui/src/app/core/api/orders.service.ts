import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap, throwError, type Observable } from 'rxjs';
import { ApiError } from './api-error';
import type { Order, OrderRequest } from './models';

/** Outcome of POST /orders: 201 completed or 422 rejected (saved as FAILED). */
export type PlaceOrderResult =
  | { kind: 'completed'; order: Order }
  | { kind: 'rejected'; order: Order; reason: string };

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);

  /** Bumped after every submitted order so views showing cash, holdings or orders can refresh. */
  readonly changes = signal(0);

  list(accountId: number): Observable<Order[]> {
    return this.http.get<Order[]>(`/api/accounts/${accountId}/orders`);
  }

  /**
   * A rejected order is a normal business outcome, not an error: the API saves it
   * as FAILED and answers 422 with the order in the body. 400 / 404 / network
   * failures still error as ApiError.
   */
  place(accountId: number, request: OrderRequest): Observable<PlaceOrderResult> {
    return this.http.post<Order>(`/api/accounts/${accountId}/orders`, request).pipe(
      map((order): PlaceOrderResult => ({ kind: 'completed', order })),
      catchError((error: unknown) => {
        if (error instanceof ApiError && error.status === 422 && isOrder(error.body)) {
          const order = error.body;
          return of<PlaceOrderResult>({ kind: 'rejected', order, reason: order.message ?? 'Order rejected' });
        }
        return throwError(() => error);
      }),
      tap(() => this.changes.update((n) => n + 1)),
    );
  }
}

function isOrder(body: unknown): body is Order {
  return typeof body === 'object' && body !== null && 'orderId' in body && 'status' in body;
}
