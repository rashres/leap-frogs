import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioStore, type Position } from '../../core/state/portfolio.store';
import { formatSignedPct, formatSignedUsd } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';

const SHOWN = 3;

/** Best and worst holdings by unrealised P/L %, adapted from fe/21-page-mascots. */
@Component({
  selector: 'leap-performance-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InstrumentLogo],
  template: `
    @if (groups().length > 0) {
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Performance</h2>
        </div>

        <div class="cols">
          @for (group of groups(); track group.key) {
            <div class="col">
              <h3 [class.up]="group.key === 'best'" [class.down]="group.key === 'worst'">{{ group.label }}</h3>
              <ul>
                @for (row of group.rows; track row.instrumentId) {
                  <li>
                    <a [routerLink]="['/instrument', row.instrumentId]">
                      <leap-instrument-logo [symbol]="row.symbol" [size]="26" />
                      <span class="sym">{{ row.symbol }}</span>
                      <span class="money num faint">{{ row.money }}</span>
                      <span class="pct num" [class.up]="row.unrealisedPnlPercent! >= 0" [class.down]="row.unrealisedPnlPercent! < 0">
                        {{ row.pct }}
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <p class="note faint">
          Ranked by unrealised P/L percentage: latest price against your average buy price. Holdings without a
          price or buy history are left out.
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
  private readonly portfolio = inject(PortfolioStore);

  private readonly ranked = computed<Position[]>(() =>
    this.portfolio
      .positions()
      .filter((p) => p.unrealisedPnlPercent != null)
      .sort((a, b) => b.unrealisedPnlPercent! - a.unrealisedPnlPercent!),
  );

  readonly groups = computed(() => {
    const ranked = this.ranked().map((p) => ({
      ...p,
      money: formatSignedUsd(p.unrealisedPnl),
      pct: formatSignedPct(p.unrealisedPnlPercent),
    }));
    const best = ranked.slice(0, SHOWN);
    // Start the worst list after the best one so a short book never repeats a row.
    const worst = ranked.slice(Math.max(best.length, ranked.length - SHOWN)).reverse();
    return [
      { key: 'best' as const, label: 'Best performers', rows: best },
      { key: 'worst' as const, label: 'Worst performers', rows: worst },
    ].filter((group) => group.rows.length > 0);
  });
}
