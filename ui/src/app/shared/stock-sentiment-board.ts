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
import type { StockSentiment } from '../core/news/news';

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
                    <span class="sent sent-pos"><i class="glyph">▲</i>{{ row.counts.positive }} pos</span>
                  }
                  @if (row.counts.neutral > 0) {
                    <span class="sent sent-neu"><i class="glyph">■</i>{{ row.counts.neutral }} neu</span>
                  }
                  @if (row.counts.negative > 0) {
                    <span class="sent sent-neg"><i class="glyph">▼</i>{{ row.counts.negative }} neg</span>
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
      :host {
        display: block;
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
      }
      th,
      td {
        text-align: left;
        padding: 14px 22px;
        vertical-align: top;
      }
      thead th {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-3);
        background: var(--panel-2);
        border-bottom: 1px solid var(--border-soft);
        padding-top: 11px;
        padding-bottom: 11px;
        white-space: nowrap;
      }
      tbody tr {
        transition: background-color 0.12s ease;
      }
      tbody tr:hover {
        background: var(--panel-hover);
      }
      tbody tr + tr {
        border-top: 1px solid var(--border-soft);
      }
      tbody tr.selected {
        background: var(--accent-soft);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      tbody tr.silent {
        opacity: 0.6;
      }
      .num {
        text-align: right;
        width: 100px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .sym {
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: left;
        padding: 2px 4px;
        margin: -2px -4px;
        border-radius: 6px;

        &:hover .ticker {
          color: var(--accent);
        }
      }
      .ticker {
        font-weight: 700;
        font-size: 14px;
      }
      .name {
        font-size: 12px;
        font-weight: 400;
        white-space: nowrap;
      }
      .counts {
        display: inline-flex;
        gap: 5px;
        flex-wrap: wrap;
      }
      .latest {
        min-width: 260px;
        max-width: 52ch;

        a {
          font-weight: 500;
          color: var(--text);
          line-height: 1.45;

          &:hover {
            color: var(--accent);
          }
        }
      }
      .why {
        display: block;
        margin-top: 4px;
        font-size: 12px;

        code {
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--panel-3);
        }
      }
      .small {
        font-size: 12px;
      }
    `,
  ],
})
export class StockSentimentBoard {
  readonly rows = input.required<readonly StockSentiment[]>();
  readonly selected = input<number | null>(null);
  readonly pick = output<number | null>();

  /** The words that put the latest headline on this row. */
  basis(row: StockSentiment): string {
    const match = row.latest?.attributions.find((a) => a.instrumentId === row.instrumentId);
    if (!match) return '—';
    return match.context ? `${match.matched} + ${match.context}` : match.matched;
  }
}
