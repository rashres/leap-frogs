import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VolumeService, type Volume } from '../../core/markets/volume.service';
import { formatPrice, formatSignedPct, formatTime } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { Sparkline } from '../../shared/sparkline';
import { DayChangeStore } from './day-change.store';
import { TPipe } from '../../core/i18n/t.pipe';
import { currentLocale, tk } from '../../core/i18n/i18n.service';

const SHOWN = 5;

const compact = { format: (v: number) => v.toLocaleString(currentLocale(), { notation: 'compact', maximumFractionDigits: 1 }) };

function formatVolume(v: Volume | null): string {
  if (!v) return '—';
  return v.isValue ? `$${compact.format(v.value)}` : compact.format(v.value);
}

/** Live prices and the recorded 24-hour move, linking to Markets for the rest. */
@Component({
  selector: 'leap-market-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, RouterLink, InstrumentLogo, Sparkline, Icon],
  template: `
    <section class="card">
      <div class="head">
        <h2 class="title">{{ 'Market Overview' | t }}</h2>
        <a class="btn btn-secondary btn-sm" routerLink="/markets">{{ 'View All' | t }} <leap-icon name="external" [size]="14" /></a>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ 'Symbol' | t }}</th>
              <th>{{ '24H trend' | t }}</th>
              <th class="r">{{ 'Price' | t }}</th>
              <th class="r">24H%</th>
              <th class="r opt">{{ 'Volume' | t }}</th>
              <th class="r opt">{{ 'Updated' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <div class="ident">
                    <leap-instrument-logo [symbol]="row.symbol" [size]="30" />
                    <div class="ident-text">
                      <a class="sym stretch-link" [routerLink]="['/instrument', row.id]" [attr.aria-label]="'View {symbol}, {name}' | t: { symbol: row.symbol, name: row.name }">{{
                        row.symbol
                      }}</a>
                      <span class="name">{{ row.name }}</span>
                    </div>
                  </div>
                </td>
                <td><leap-sparkline [points]="row.points" [reference]="row.reference" [width]="72" [height]="28" /></td>
                <td class="r">
                  <div class="price num">{{ row.price }}</div>
                  @if (row.delta) {
                    <div class="delta num" [class.up]="row.dir > 0" [class.down]="row.dir < 0">{{ row.delta }}</div>
                  }
                </td>
                <td class="r num pct" [class.up]="row.dir > 0" [class.down]="row.dir < 0">{{ row.pct ?? '—' }}</td>
                <td class="r num vol opt" [attr.title]="row.volumeTitle | t">{{ row.volume }}</td>
                <td class="r num when opt">{{ row.updated }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (rows().length === 0) {
          <p class="empty">
            @if (!store.loaded()) {
              {{ 'Loading prices…' | t }}
            } @else {
              {{ 'No instruments in the database.' | t }}
            }
          </p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 20px 24px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px 16px;
        min-height: 34px;
        margin-bottom: 14px;
      }
      .title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.005em;
      }
      /* Header plus room for five rows, so the card keeps its height while prices load. */
      .table-wrap {
        position: relative;
        overflow-x: auto;
        min-height: calc(37px + 5 * 54px);
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
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      td {
        height: 54px;
        padding: 0 12px;
        white-space: nowrap;
      }
      th:first-child,
      td:first-child {
        padding-left: 0;
      }
      th:last-child,
      td:last-child {
        padding-right: 0;
      }
      .r {
        text-align: right;
      }
      tbody tr {
        position: relative;
      }
      tbody tr:hover .sym {
        color: var(--accent);
      }
      .ident {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ident-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.35;
      }
      .sym {
        font-weight: 600;
        border-radius: 4px;
      }
      .name {
        font-size: 12px;
        color: var(--text-3);
        max-width: 170px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .price {
        font-weight: 600;
        line-height: 1.35;
      }
      .delta {
        font-size: 12px;
        line-height: 1.35;
      }
      .pct {
        font-weight: 500;
      }
      .vol {
        font-size: 12.5px;
      }
      .when {
        color: var(--text-3);
        font-size: 12.5px;
      }
      /* Phones: drop the secondary columns so price and change stay in view. */
      @media (max-width: 560px) {
        .card {
          padding: 16px;
        }
        .opt,
        .ident leap-instrument-logo {
          display: none;
        }
        th,
        td {
          padding-inline: 8px;
        }
        th:nth-child(4),
        .pct {
          padding-right: 0;
        }
        leap-sparkline ::ng-deep svg {
          width: 48px;
        }
        .name {
          max-width: 90px;
        }
      }
      .empty {
        position: absolute;
        inset: 37px 0 0;
        display: grid;
        place-items: center;
        margin: 0;
        font-size: 13px;
        color: var(--text-3);
      }
    `,
  ],
})
export class MarketOverview {
  protected readonly store = inject(DayChangeStore);
  private readonly volumes = inject(VolumeService);
  private readonly shown = computed(() => this.store.rows().slice(0, SHOWN));

  constructor() {
    effect(() => this.volumes.load(this.shown().map((r) => r.symbol)));
  }

  readonly rows = computed(() =>
    this.shown().map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      points: r.points,
      reference: r.reference,
      price: formatPrice(r.price),
      pct: r.changePct != null ? formatSignedPct(r.changePct) : null,
      delta: r.change != null ? `${r.change < 0 ? '−' : '+'}${formatPrice(Math.abs(r.change), r.price)}` : '',
      dir: Math.sign(r.change ?? 0),
      volume: formatVolume(this.volumes.get(r.symbol)),
      volumeTitle: this.volumes.get(r.symbol)?.isValue ? tk('Value traded today (Yahoo Finance)') : tk('Units traded today (Yahoo Finance)'),
      updated: r.updatedAt ? formatTime(r.updatedAt) : '—',
    })),
  );
}
