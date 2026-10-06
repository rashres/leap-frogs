import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Order } from '../../core/api/models';
import { DateTimePipe, QtyPipe, UsdPipe } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { StatusPill } from '../../shared/status-pill';

/** Order history (GET /api/accounts/{id}/orders), newest first as returned by the API. */
@Component({
  selector: 'leap-orders-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InstrumentLogo, StatusPill, UsdPipe, QtyPipe, DateTimePipe],
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Placed</th>
            <th>Order</th>
            <th class="r">Quantity</th>
            <th class="r">Price</th>
            <th class="r">Value</th>
            <th>Status</th>
            @if (!compact()) {
              <th>Filled</th>
              <th class="r">#</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (o of orders(); track o.orderId) {
            <tr [class.rejected]="o.status === 'FAILED'">
              <td class="num faint nowrap">{{ o.placedTime | dateTime }}</td>
              <td>
                <div class="ident">
                  <leap-instrument-logo [symbol]="o.symbol" [size]="24" />
                  <span class="side" [class.buy]="o.side === 'BUY'" [class.sell]="o.side === 'SELL'">{{ o.side }}</span>
                  <span class="sym">{{ o.symbol }}</span>
                </div>
              </td>
              <td class="r num">{{ o.quantity | qty }}</td>
              <td class="r num dim">{{ o.price | usd }}</td>
              <td class="r num strong">{{ o.value | usd }}</td>
              <td><leap-status-pill [status]="o.status" /></td>
              @if (!compact()) {
                <td class="num faint nowrap">{{ o.fulfilledTime | dateTime }}</td>
                <td class="r num faint">{{ o.orderId }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      .nowrap {
        white-space: nowrap;
      }
      tr.rejected .strong {
        color: var(--text-3);
        text-decoration: line-through;
        text-decoration-color: var(--border-strong);
      }
    `,
  ],
})
export class OrdersTable {
  readonly orders = input.required<Order[]>();
  /** Hide the filled-time and id columns, for narrower panels. */
  readonly compact = input(false);
}
