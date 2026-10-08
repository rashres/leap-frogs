import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { marketFor } from '../../core/markets/sessions';
import { MarketStore } from '../../core/state/market.store';
import { PortfolioStore } from '../../core/state/portfolio.store';
import { formatUsd } from '../../shared/format';

/** Cash balance. The platform settles in USD only, so there is one balance. */
@Component({
  selector: 'leap-cash-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2 class="panel-title">Cash</h2>
          <p class="panel-sub">Settled in USD only</p>
        </div>
        <span class="total num">{{ total() }} <span class="faint">total</span></span>
      </div>

      <div class="cells">
        <div class="cell">
          <span class="ic t-cash" aria-hidden="true">$</span>
          <div class="cell-text">
            <p class="label">USD cash</p>
            <p class="amount num">{{ cash() }}</p>
            <p class="hint faint">Buying power for every instrument</p>
            @if (buys()) {
              <span class="tag">{{ buys() }}</span>
            }
          </div>
        </div>
        <div class="cell">
          <span class="ic t-inv" aria-hidden="true">↗</span>
          <div class="cell-text">
            <p class="label">Invested</p>
            <p class="amount num">{{ invested() }}</p>
            <p class="hint faint">Market value of priced holdings</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .cells {
        display: grid;
        gap: 12px;
        padding: 18px 22px 22px;
      }
      .cell {
        display: flex;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--radius);
        background: var(--panel-2);
        border: 1px solid var(--border-soft);
      }
      .ic {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .t-cash {
        background: var(--up-soft);
        color: var(--up);
      }
      .t-inv {
        background: var(--accent-soft);
        color: var(--accent);
      }
      .cell-text {
        min-width: 0;
      }
      .label {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-3);
      }
      .amount {
        margin: 2px 0 0;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.015em;
      }
      .hint {
        margin: 2px 0 0;
        font-size: 12.5px;
      }
      .tag {
        margin-top: 8px;
        text-transform: none;
        letter-spacing: 0;
        background: var(--panel);
        border: 1px solid var(--border-soft);
      }
      .total {
        font-size: 13.5px;
        font-weight: 600;
      }
    `,
  ],
})
export class CashPanel {
  private readonly portfolio = inject(PortfolioStore);
  private readonly market = inject(MarketStore);

  readonly cash = computed(() => formatUsd(this.portfolio.cash()));
  readonly invested = computed(() => formatUsd(this.portfolio.marketValue()));
  readonly total = computed(() => formatUsd(this.portfolio.totalValue()));

  /** Markets this cash can buy, from the exchanges in the database. */
  readonly buys = computed(() => {
    const labels = new Set<string>();
    for (const i of this.market.instruments()) {
      labels.add(marketFor(i.exchange)?.shortLabel ?? i.exchange);
    }
    return [...labels].join(' · ');
  });
}
