/**
 * Cash balances, one row per currency.
 *
 * US-13 asks a client to view their cash balance. Under the locked cash model
 * there is no single balance to show: an account holds GBP, USD and INR
 * independently and none of them is convertible without an explicit FX order.
 * The panel therefore lists balances and shows what each one can and cannot buy.
 *
 * [US-13]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MarketDataService } from '../../core/data/market-data.service';
import { PortfolioService } from '../../core/data/portfolio.service';
import { INSTRUMENT_CLASS_POLICIES, type InstrumentClassCode } from '../../core/domain/instrument';
import type { CurrencyCode } from '../../core/money/currency';

@Component({
  selector: 'leap-cash-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Cash · {{ rows().length }} currencies</h2>
        <span class="total num dim">{{ portfolio.totalCash().format() }} total</span>
      </div>

      <div class="grid">
        @for (row of rows(); track row.currency) {
          <div class="cell">
            <div class="cell-head">
              <span class="code">{{ row.currency }}</span>
              <span class="tag">{{ row.buys }}</span>
            </div>
            <p class="amount num">{{ row.available.format() }}</p>
            <p class="converted num faint">
              @if (row.converted) {
                ≈ {{ row.converted.format() }} {{ portfolio.displayCurrency() }}
              }
            </p>
          </div>
        }
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
  private readonly market = inject(MarketDataService);
  protected readonly portfolio = inject(PortfolioService);

  /** Which instrument classes each currency can actually settle. */
  private readonly settles: Record<CurrencyCode, string> = (() => {
    const map: Partial<Record<CurrencyCode, string[]>> = {};
    for (const code of Object.keys(INSTRUMENT_CLASS_POLICIES) as InstrumentClassCode[]) {
      const policy = INSTRUMENT_CLASS_POLICIES[code];
      (map[policy.settlementCurrency] ??= []).push(policy.shortLabel);
    }
    return Object.fromEntries(
      Object.entries(map).map(([currency, labels]) => [currency, labels!.join(' · ')]),
    ) as Record<CurrencyCode, string>;
  })();

  readonly rows = computed(() =>
    this.portfolio.cashBalances().map((balance) => ({
      currency: balance.currency,
      available: balance.available,
      buys: this.settles[balance.currency] ?? '—',
      converted:
        balance.currency === this.portfolio.displayCurrency()
          ? null
          : this.market.convertForDisplay(balance.available, this.portfolio.displayCurrency()),
    })),
  );
}
