/**
 * Live status strip for orders still in flight.
 *
 * US-09 asks for real-time order status. The agreed mechanism for the backend
 * is server-sent events; on this fixture-backed frontend the same view is fed
 * by the OrderService signal, so swapping the source for an SSE stream changes
 * the service and not this component.
 *
 * The panel hides itself when nothing is working, so it never occupies the rail
 * without cause.
 *
 * [US-09]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/data/order.service';
import { ORDER_STATE_LABELS } from '../../core/domain/order';
import { InstrumentLogo } from '../../shared/instrument-logo';

@Component({
  selector: 'leap-working-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo],
  template: `
    <!-- [US-09] Announced to screen readers as orders change state, so a fill is
         not a silently visual-only event. -->
    <div aria-live="polite" class="sr-only">{{ announcement() }}</div>
    @if (rows().length > 0) {
      <div class="panel live">
        <div class="panel-head">
          <h2 class="panel-title">
            <i class="pulse"></i>
            Working orders
          </h2>
          <span class="tag">{{ rows().length }}</span>
        </div>
        <ul>
          @for (row of rows(); track row.id) {
            <li>
              <a [routerLink]="['/instrument', row.instrumentId]">
                <div class="line">
                  <leap-instrument-logo [instrumentId]="row.instrumentId" [symbol]="row.symbol" [size]="24" />
                  <span class="side" [class.buy]="row.side === 'BUY'" [class.sell]="row.side === 'SELL'">
                    {{ row.side }}
                  </span>
                  <span class="sym">{{ row.symbol }}</span>
                  <span class="qty num dim">{{ row.quantity }}</span>
                  <span class="pill pill-accent">{{ row.state }}</span>
                </div>
                <div class="ref faint num">{{ row.reference }} · routed for execution</div>
              </a>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    `
      .live {
        border-color: var(--border);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li + li {
        border-top: 1px solid var(--border-soft);
      }
      a {
        display: block;
        padding: 11px 16px;
      }
      a:hover {
        background: var(--panel-hover);
      }
      .line {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .side {
        font-size: 10px;
        font-weight: 750;
        letter-spacing: 0.06em;
      }
      .side.buy {
        color: var(--up);
      }
      .side.sell {
        color: var(--down);
      }
      .sym {
        font-size: 13px;
        font-weight: 700;
      }
      .qty {
        font-size: 12px;
        margin-right: auto;
      }
      .ref {
        font-size: 10.5px;
        margin-top: 3px;
      }
      .pulse {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        margin-right: 6px;
        animation: pulse 1.4s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.25;
        }
      }
    `,
  ],
})
export class WorkingOrders {
  private readonly orders = inject(OrderService);

  /** Spoken summary of what is currently in flight. */
  readonly announcement = computed(() => {
    const working = this.orders.workingOrders();
    if (working.length === 0) return 'No working orders.';
    return working
      .map(
        (order) =>
          `${order.side} ${order.quantity.toTrimmedString()} ${order.symbol}, ${ORDER_STATE_LABELS[order.state]}.`,
      )
      .join(' ');
  });

  readonly rows = computed(() =>
    this.orders.workingOrders().map((order) => ({
      id: order.id,
      instrumentId: order.instrumentId,
      reference: order.reference,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity.toTrimmedString(),
      state: ORDER_STATE_LABELS[order.state],
    })),
  );
}
