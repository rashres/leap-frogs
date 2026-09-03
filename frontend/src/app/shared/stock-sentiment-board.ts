/**
 * Headline sentiment across the main stocks.
 *
 * What this row says is "eleven headlines named this company in the last week,
 * three of them worded positively". What it does not say — anywhere, in any
 * form — is what to do about that. There is no score out of ten, no arrow, no
 * ranking of the stocks against each other, and no colour on the row itself.
 * The counts are coloured because the words behind them are; the stock is not.
 *
 * A stock with nothing written about it says "no headlines", not "neutral".
 * Silence and balance look identical in an aggregate and mean opposite things.
 *
 * [4.1]
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StockSentiment } from '../core/domain/news';

@Component({
  selector: 'leap-stock-sentiment-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table>
      <caption class="sr-only">
        Headline counts per stock, by the wording of the headline
      </caption>
      <thead>
        <tr>
          <th scope="col">Stock</th>
          <th scope="col" class="num">Headlines</th>
          <th scope="col">By wording</th>
          <th scope="col">Most recent</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.instrumentId) {
          <tr
            [class.selected]="row.instrumentId === selected()"
            [class.silent]="row.counts.total === 0"
          >
            <th scope="row">
              <button
                type="button"
                class="sym"
                [attr.aria-pressed]="row.instrumentId === selected()"
                (click)="pick.emit(row.instrumentId === selected() ? null : row.instrumentId)"
              >
                <span class="ticker">{{ row.symbol }}</span>
                <span class="name faint">{{ row.name }}</span>
              </button>
            </th>

            <td class="num">
              @if (row.counts.total === 0) {
                <span class="faint">—</span>
              } @else {
                {{ row.counts.total }}
              }
            </td>

            <td>
              @if (row.counts.total === 0) {
                <span class="faint small">No headlines in the window</span>
              } @else {
                <span class="counts">
                  @if (row.counts.positive > 0) {
                    <span class="pill pill-good">{{ row.counts.positive }} pos</span>
                  }
                  @if (row.counts.neutral > 0) {
                    <span class="pill pill-muted">{{ row.counts.neutral }} neu</span>
                  }
                  @if (row.counts.negative > 0) {
                    <span class="pill pill-bad">{{ row.counts.negative }} neg</span>
                  }
                </span>
              }
            </td>

            <td class="latest">
              @if (row.latest; as item) {
                <a [href]="item.link" target="_blank" rel="noopener noreferrer">{{ item.title }}</a>
                <span class="why faint">
                  {{ item.publisher }} · filed under {{ row.symbol }} on
                  <code>{{ basis(row) }}</code>
                </span>
              } @else {
                <span class="faint small">—</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: [
    `
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
      }
      th,
      td {
        text-align: left;
        padding: 10px 16px;
        vertical-align: top;
      }
      thead th {
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-3);
        border-bottom: 1px solid var(--border-soft);
        padding-top: 8px;
        padding-bottom: 8px;
      }
      tbody tr + tr {
        border-top: 1px solid var(--border-soft);
      }
      tbody tr.selected {
        background: var(--accent-soft);
      }
      tbody tr.silent {
        opacity: 0.62;
      }
      .num {
        text-align: right;
        width: 88px;
        font-variant-numeric: tabular-nums;
      }
      .sym {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: left;
        padding: 0;
      }
      .ticker {
        font-weight: 680;
        font-size: 12.5px;
      }
      .name {
        font-size: 11px;
        font-weight: 400;
      }
      .counts {
        display: inline-flex;
        gap: 5px;
        flex-wrap: wrap;
      }
      .latest {
        max-width: 46ch;

        a {
          font-weight: 560;
          color: var(--text);
          line-height: 1.4;

          &:hover {
            color: var(--accent);
            text-decoration: underline;
          }
        }
      }
      .why {
        display: block;
        margin-top: 4px;
        font-size: 10.5px;

        code {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 3px;
          background: var(--panel-3);
        }
      }
      .small {
        font-size: 11px;
      }
      @media (max-width: 900px) {
        .latest {
          max-width: none;
        }
      }
    `,
  ],
})
export class StockSentimentBoard {
  readonly rows = input.required<readonly StockSentiment[]>();
  readonly selected = input<string | null>(null);
  readonly pick = output<string | null>();

  /** The words that put the latest headline on this row. */
  basis(row: StockSentiment): string {
    const match = row.latest?.attributions.find((a) => a.instrumentId === row.instrumentId);
    if (!match) return '—';
    return match.context ? `${match.matched} + ${match.context}` : match.matched;
  }
}
