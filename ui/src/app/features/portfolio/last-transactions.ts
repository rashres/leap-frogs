import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatPrice, formatQty, formatUsd } from '../../shared/format';

const SHOWN = 5;

/** The account's latest filled orders. Submitted, working and rejected orders live on the Orders page. */
@Component({
  selector: 'leap-last-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="card">
      <div class="head">
        <h2 class="title">Last Transaction</h2>
        <a class="btn btn-secondary btn-sm" routerLink="/orders">View All</a>
      </div>

      @if (portfolio.orders.error(); as e) {
        <p class="state-error">{{ e.message }}</p>
      } @else if (portfolio.orders.initialLoading()) {
        <div class="loading" aria-hidden="true">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <span class="skeleton"></span>
          }
        </div>
        <p class="sr-only" role="status">Loading transactions…</p>
      } @else if (rows().length === 0) {
        <p class="none">No filled transactions yet. <a routerLink="/markets">Browse markets</a> to place an order.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.orderId) {
                <tr>
                  <td>
                    <span class="type" [class.buy]="row.side === 'BUY'" [class.sell]="row.side === 'SELL'">
                      {{ row.side === 'BUY' ? 'Buy' : 'Sell' }}
                    </span>
                  </td>
                  <td>
                    <a class="sym" [routerLink]="['/instrument', row.instrumentId]">{{ row.symbol }}</a>
                  </td>
                  <td class="num">{{ row.qty }}</td>
                  <td class="num">{{ row.price }}</td>
                  <td class="num">{{ row.total }}</td>
                  <td class="when">{{ row.when }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        height: 100%;
        padding: 20px 24px 12px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.005em;
      }
      .table-wrap {
        position: relative;
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
      }
      th {
        padding: 10px 12px;
        text-align: left;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--text-3);
        border-top: 1px solid var(--border-soft);
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      td {
        padding: 12px;
        white-space: nowrap;
        color: var(--text);
      }
      tbody tr + tr td {
        border-top: 1px solid color-mix(in srgb, var(--border-soft) 60%, transparent);
      }
      .type {
        display: inline-block;
        min-width: 42px;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        text-align: center;
      }
      .type.buy {
        background: var(--up-soft);
        color: var(--up);
      }
      .type.sell {
        background: var(--down-soft);
        color: var(--down);
      }
      .sym {
        font-weight: 500;
      }
      .sym:hover {
        color: var(--accent);
      }
      .when {
        color: var(--text-3);
      }
      .none {
        margin: 0;
        padding: 16px 0 20px;
        font-size: 13px;
        color: var(--text-3);
      }
      .none a {
        color: var(--accent);
        font-weight: 500;
      }
      .loading {
        display: grid;
        gap: 14px;
        padding: 12px 0 20px;
      }
      .loading .skeleton {
        height: 14px;
      }
      @media (max-width: 560px) {
        .card {
          padding: 16px 16px 8px;
        }
        th,
        td {
          padding-left: 10px;
          padding-right: 10px;
        }
      }
    `,
  ],
})
export class LastTransactions {
  protected readonly portfolio = inject(PortfolioStore);

  readonly rows = computed(() => {
    const now = new Date();
    return this.portfolio
      .orderList()
      .filter((o) => o.status === 'COMPLETE')
      .sort((a, b) => stamp(b) - stamp(a))
      .slice(0, SHOWN)
      .map((o) => ({
        ...o,
        qty: formatQty(o.quantity),
        price: formatPrice(o.price),
        total: formatUsd(o.value),
        when: relativeDay(new Date(o.fulfilledTime ?? o.placedTime), now),
      }));
  });
}

function stamp(o: { fulfilledTime: string | null; placedTime: string }): number {
  return new Date(o.fulfilledTime ?? o.placedTime).getTime();
}

/** "Today, 9:41 AM", "Yesterday, 12:41 PM", otherwise "06 Oct, 9:25 AM". */
function relativeDay(at: Date, now: Date): string {
  if (Number.isNaN(at.getTime())) return '—';
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${at.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${time}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
