/**
 * Best and worst performing holdings.
 *
 * A ranking of the client's OWN positions, so it extends US-12 rather than
 * introducing anything new. Cross-client analytics is a different thing
 * entirely — US-21/US-23 belong to PS-06 and must run off the separate
 * reporting store (BR-16), not this read model.
 *
 * Ranked by unrealised P/L percentage rather than absolute money, because the
 * account holds three currencies and an absolute ranking would silently compare
 * INR against USD. The percentage is currency-neutral; the money column stays
 * in each instrument's own currency.
 *
 * [US-12]
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioService } from '../../core/data/portfolio.service';
import type { HoldingView } from '../../core/domain/portfolio';
import { InstrumentLogo } from '../../shared/instrument-logo';

const SHOWN = 3;

@Component({
  selector: 'leap-performance-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo],
  template: `
    @if (hasHoldings()) {
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Performance</h2>
          <span class="trace"><code>US-12</code></span>
        </div>

        <div class="cols">
          @for (group of groups(); track group.key) {
            <div class="col">
              <h3 [class.up]="group.key === 'best'" [class.down]="group.key === 'worst'">
                {{ group.label }}
              </h3>
              <ul>
                @for (row of group.rows; track row.instrumentId) {
                  <li>
                    <a [routerLink]="['/instrument', row.instrumentId]">
                      <leap-instrument-logo
                        [instrumentId]="row.instrumentId"
                        [symbol]="row.symbol"
                        [size]="26"
                      />
                      <span class="sym">{{ row.symbol }}</span>
                      <span class="money num faint">{{ row.unrealisedPnl.formatSigned() }}</span>
                      <span
                        class="pct num"
                        [class.up]="!row.unrealisedPnlPercent.isNegative()"
                        [class.down]="row.unrealisedPnlPercent.isNegative()"
                      >
                        {{ row.unrealisedPnlPercent.isNegative() ? '' : '+'
                        }}{{ row.unrealisedPnlPercent.toString() }}%
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <p class="note faint">
          Ranked by unrealised P/L percentage. Absolute amounts stay in each instrument's own currency and are
          not comparable across the three you hold.
        </p>
      </div>
    }
  `,
  styles: [
    `
      .cols {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .col {
        padding: 4px 0 8px;
        border-right: 1px solid var(--border-soft);
      }
      .col:last-child {
        border-right: none;
      }
      h3 {
        margin: 10px 16px 6px;
        font-size: 10.5px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      a {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 10px;
        padding: 7px 16px;
        transition: background 0.12s ease;
      }
      a:hover {
        background: var(--panel-hover);
      }
      .sym {
        font-size: 12.5px;
        font-weight: 700;
      }
      .money {
        font-size: 11.5px;
      }
      .pct {
        font-size: 12.5px;
        font-weight: 700;
        min-width: 56px;
        text-align: right;
      }
      .note {
        margin: 0;
        padding: 10px 16px 12px;
        border-top: 1px solid var(--border-soft);
        font-size: 11px;
        line-height: 1.5;
      }
      @media (max-width: 640px) {
        .col {
          border-right: none;
          border-bottom: 1px solid var(--border-soft);
        }
      }
    `,
  ],
})
export class PerformancePanel {
  private readonly portfolio = inject(PortfolioService);

  private readonly ranked = computed<readonly HoldingView[]>(() =>
    [...this.portfolio.holdings()].sort((a, b) =>
      b.unrealisedPnlPercent.compareTo(a.unrealisedPnlPercent),
    ),
  );

  readonly hasHoldings = computed(() => this.ranked().length > 0);

  readonly groups = computed(() => {
    const ranked = this.ranked();
    return [
      { key: 'best' as const, label: 'Best performers', rows: ranked.slice(0, SHOWN) },
      {
        key: 'worst' as const,
        label: 'Worst performers',
        rows: ranked.slice(-SHOWN).reverse(),
      },
    ];
  });
}
