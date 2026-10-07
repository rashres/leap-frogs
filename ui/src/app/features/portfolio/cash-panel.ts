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
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Cash · USD</h2>
        <span class="total num dim">{{ total() }} total</span>
      </div>

      <div class="grid">
        <div class="cell">
          <div class="cell-head">
            <span class="code">USD</span>
            @if (buys()) {
              <span class="tag">{{ buys() }}</span>
            }
          </div>
          <p class="amount num">{{ cash() }}</p>
          <p class="converted num faint">Buying power for every instrument</p>
        </div>
        <div class="cell">
          <div class="cell-head">
            <span class="code">Invested</span>
          </div>
          <p class="amount num">{{ invested() }}</p>
          <p class="converted num faint">Market value of priced holdings</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .cell {
        padding: 15px 18px 17px;
        border-right: 1px solid var(--border-soft);
      }
      .cell:last-child {
        border-right: none;
      }
      .cell-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .code {
        font-size: 11.5px;
        font-weight: 750;
        letter-spacing: 0.08em;
        color: var(--text-2);
      }
      .amount {
        margin: 0;
        font-size: 21px;
        font-weight: 650;
        letter-spacing: -0.014em;
      }
      .converted {
        margin: 3px 0 0;
        font-size: 11.5px;
        min-height: 17px;
      }
      .total {
        font-size: 12px;
      }
      @media (max-width: 640px) {
        .cell {
          border-right: none;
          border-bottom: 1px solid var(--border-soft);
        }
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
