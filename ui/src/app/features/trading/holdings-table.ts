import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Holding, OrderSide } from '../../core/api/models';
import { QtyPipe } from '../../shared/format';
import { InstrumentLogo } from '../../shared/instrument-logo';

export interface TradeIntent {
  instrumentId: number;
  side: OrderSide;
}

/** Holdings across every exchange, with quick Buy / Sell actions that prefill a ticket. */
@Component({
  selector: 'leap-holdings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InstrumentLogo, QtyPipe],
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Market</th>
            <th class="r">Quantity</th>
            @if (actions()) {
              <th class="r"><span class="sr-only">Actions</span></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (h of holdings(); track h.instrumentId) {
            <tr>
              <td>
                <div class="ident">
                  <leap-instrument-logo [symbol]="h.symbol" [size]="30" />
                  <div class="ident-text">
                    <div class="sym">{{ h.symbol }}</div>
                    <div class="name">{{ h.instrumentName }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div>{{ h.exchange }}</div>
                <div class="faint small">{{ h.country }}</div>
              </td>
              <td class="r num strong">{{ h.quantity | qty }}</td>
              @if (actions()) {
                <td class="r">
                  <div class="row-actions">
                    <button type="button" class="btn btn-sm" (click)="trade.emit({ instrumentId: h.instrumentId, side: 'BUY' })">
                      Buy
                    </button>
                    <button type="button" class="btn btn-sm" (click)="trade.emit({ instrumentId: h.instrumentId, side: 'SELL' })">
                      Sell
                    </button>
                  </div>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      .small {
        font-size: 12px;
      }
      .row-actions {
        display: inline-flex;
        gap: 6px;
      }
    `,
  ],
})
export class HoldingsTable {
  readonly holdings = input.required<Holding[]>();
  readonly actions = input(true);
  readonly trade = output<TradeIntent>();
}
