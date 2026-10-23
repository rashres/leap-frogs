import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { SentimentLabel, StockSentiment } from '../../core/news/news';
import { MOOD_GLYPH, MOOD_LABEL, MOOD_TONE } from './news-format';

/**
 * The pond: one lily pad per stock, placed left to right by net headline tone
 * and sized by how many headlines it has.
 *
 * Net tone is (positive − negative) ÷ headlines, so it runs from −1 to +1. Within
 * ±0.10 a stock sits in the neutral zone. Unlike the rest of the page this does
 * place stocks by tone, so it carries its own key, a "Faded = under 5" warning
 * for thin coverage, and a table view that keeps the usual order (most written
 * about first). Stocks with no headlines are left off: silence is not neutral.
 */

const W = 1000;
const H = 380;
const ZW = W / 3;
const TOP = 44;
const AXIS = H - 30;
/** Space for the symbol tag under a pad. */
const TAG = 34;
const LOW = 5;

const ZONES: readonly { label: SentimentLabel; range: readonly [number, number] }[] = [
  { label: 'negative', range: [-1, -0.1] },
  { label: 'neutral', range: [-0.1, 0.1] },
  { label: 'positive', range: [0.1, 1] },
];

const TICKS: readonly [number, string][] = [
  [-1, '−1'],
  [-0.5, '−0.5'],
  [-0.1001, '−0.1'],
  [0, '0'],
  [0.0999, '+0.1'],
  [0.5, '+0.5'],
  [1, '+1'],
];

const FROG: Readonly<Record<SentimentLabel, string>> = {
  positive: 'mascot/sentiment-positive.png',
  neutral: 'mascot/sentiment-neutral.png',
  negative: 'mascot/sentiment-negative.png',
};

const zoneOf = (net: number): SentimentLabel => (net <= -0.1 ? 'negative' : net >= 0.1 ? 'positive' : 'neutral');

/** Where a net score lands across the three equal-width zones. */
function xOf(net: number): number {
  const i = ZONES.findIndex((z) => z.label === zoneOf(net));
  const [a, b] = ZONES[i].range;
  return i * ZW + 50 + ((Math.max(-1, Math.min(1, net)) - a) / (b - a)) * (ZW - 100);
}

/** A circle with a notch cut out, like a lily pad. */
function padPath(cx: number, cy: number, r: number, rot: number): string {
  const a1 = ((rot - 18) * Math.PI) / 180;
  const a2 = ((rot + 18) * Math.PI) / 180;
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M${cx},${cy} L${p(a1)} A${r},${r} 0 1 0 ${p(a2)} Z`;
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;

interface Pad {
  id: number;
  symbol: string;
  name: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  net: number;
  zone: SentimentLabel;
  low: boolean;
  x: number;
  y: number;
  r: number;
  path: string;
  label: string;
}

@Component({
  selector: 'leap-news-pond',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel pond" aria-labelledby="pond-title">
      <div class="head">
        <div>
          <span class="eyebrow">The pond</span>
          <h2 id="pond-title">Where every stock sits</h2>
        </div>
        <div class="keys">
          <span class="key"><i class="pk"></i>Size = headlines</span>
          <span class="key"><i class="pk low"></i>Faded = under {{ low }}</span>
          <div class="segmented" role="group" aria-label="Pond view">
            <button type="button" [class.on]="view() === 'pond'" [attr.aria-pressed]="view() === 'pond'" (click)="view.set('pond')">Pond</button>
            <button type="button" [class.on]="view() === 'table'" [attr.aria-pressed]="view() === 'table'" (click)="view.set('table')">Table</button>
          </div>
        </div>
      </div>

      @if (pads().length === 0) {
        <p class="none faint">No stock has headlines yet, so the pond is empty.</p>
      } @else if (view() === 'pond') {
        <div class="svg-wrap">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="group" aria-label="Stocks placed by net headline tone: negative left, neutral middle, positive right">
            @for (z of zones; track z.label; let i = $index) {
              <rect [attr.x]="i * zw" y="0" [attr.width]="zw" [attr.height]="h" [attr.class]="'zone z-' + tone[z.label]" />
              <text [attr.x]="i * zw + zw / 2" y="28" text-anchor="middle" [attr.class]="'zone-label t-' + tone[z.label]">
                {{ glyph[z.label] }} {{ label[z.label] }}
              </text>
              <line [attr.x1]="i * zw + 40" [attr.y1]="axis" [attr.x2]="(i + 1) * zw - 40" [attr.y2]="axis" [attr.class]="'axis t-' + tone[z.label]" />
            }
            <line [attr.x1]="zw" y1="0" [attr.x2]="zw" [attr.y2]="h" class="divider" />
            <line [attr.x1]="2 * zw" y1="0" [attr.x2]="2 * zw" [attr.y2]="h" class="divider" />
            @for (t of ticks; track t.label) {
              <line [attr.x1]="t.x" [attr.y1]="axis" [attr.x2]="t.x" [attr.y2]="axis + 6" [attr.class]="'axis t-' + t.tone" />
              <text [attr.x]="t.x" [attr.y]="axis + 19" text-anchor="middle" [attr.class]="'tick t-' + t.tone">{{ t.label }}</text>
            }

            @for (p of pads(); track p.id) {
              <g class="pad" tabindex="0" role="button" [class.low]="p.low" [class.dim]="selected() !== null && selected() !== p.id"
                 [attr.aria-pressed]="selected() === p.id" [attr.aria-label]="p.label"
                 (click)="pickStock.emit(p.id)" (keydown.enter)="pickStock.emit(p.id)" (keydown.space)="$event.preventDefault(); pickStock.emit(p.id)">
                <title>{{ p.label }}</title>
                <circle class="ring" [class.on]="selected() === p.id" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.r + 5" />
                <path class="leaf" [attr.d]="p.path" />
                <image [attr.href]="frog[p.zone]" [attr.x]="p.x - p.r * 0.575" [attr.y]="p.y - p.r * 0.5 - 2"
                       [attr.width]="p.r * 1.15" [attr.height]="p.r * 0.97" />
                <rect class="tag" [class.on]="selected() === p.id" [attr.x]="p.x - 36" [attr.y]="p.y + p.r + 5" width="72" height="29" rx="14.5" />
                <text class="tag-sym" [attr.x]="p.x" [attr.y]="p.y + p.r + 18" text-anchor="middle">{{ p.symbol }}</text>
                <text class="tag-sub" [attr.x]="p.x" [attr.y]="p.y + p.r + 29" text-anchor="middle">
                  {{ p.total }} · {{ signed(p.net) }}{{ p.low ? ' · low' : '' }}
                </text>
              </g>
            }
          </svg>
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Stocks by headline tone, most written about first</caption>
            <thead>
              <tr><th>Stock</th><th class="n">Headlines</th><th class="n">Negative</th><th class="n">Neutral</th><th class="n">Positive</th><th class="n">Net</th><th>Zone</th></tr>
            </thead>
            <tbody>
              @for (p of pads(); track p.id) {
                <tr [class.on]="selected() === p.id">
                  <td>
                    <button type="button" class="sym" [attr.aria-pressed]="selected() === p.id" (click)="pickStock.emit(p.id)">{{ p.symbol }}</button>
                    <span class="faint">{{ p.name }}</span>
                  </td>
                  <td class="n num">{{ p.total }}@if (p.low) { <span class="faint"> · low</span>}</td>
                  <td class="n num">{{ p.negative }}</td>
                  <td class="n num">{{ p.neutral }}</td>
                  <td class="n num">{{ p.positive }}</td>
                  <td class="n num">{{ signed(p.net) }}</td>
                  <td><span class="sent" [class]="'sent-' + tone[p.zone]"><i class="glyph">{{ glyph[p.zone] }}</i>{{ label[p.zone] }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <p class="foot faint">
        Net tone = (positive − negative) ÷ headlines. Within ±0.10 counts as neutral.
        @if (silent().length > 0) {
          Not shown, no headlines: {{ silent().join(', ') }}.
        }
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        --leaf: #dbe9b4;
        --leaf-line: #7f9f2c;
        --tag-bg: #ffffff;
        --tag-ink: #14201a;
        --tag-sub: #3f4d44;
      }
      :host-context([data-theme='dark']) {
        --leaf: #c8dc8f;
        --leaf-line: #9fbf45;
        --tag-bg: #1c1c1c;
        --tag-ink: #f2f2f2;
        --tag-sub: #b3b3b3;
      }
      .pond {
        overflow: hidden;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        padding: 16px 22px;
      }
      .eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--up);
      }
      h2 {
        margin: 2px 0 0;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: -0.015em;
      }
      .keys {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
      }
      .key {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: var(--text-3);
      }
      .pk {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--leaf);
        border: 2px solid var(--leaf-line);
      }
      .pk.low {
        opacity: 0.5;
      }
      .svg-wrap {
        overflow-x: auto;
        border-top: 1px solid var(--border-soft);
      }
      svg {
        display: block;
        width: 100%;
        min-width: 660px;
        height: auto;
      }
      .zone.z-neg {
        fill: var(--down-soft);
      }
      .zone.z-neu {
        fill: var(--panel-2);
      }
      .zone.z-pos {
        fill: var(--up-soft);
      }
      .zone-label {
        font-size: 13px;
        font-weight: 600;
      }
      .t-neg {
        fill: var(--down);
        stroke: var(--down);
      }
      .t-neu {
        fill: var(--text-3);
        stroke: var(--text-3);
      }
      .t-pos {
        fill: var(--up);
        stroke: var(--up);
      }
      text.t-neg,
      text.t-neu,
      text.t-pos {
        stroke: none;
      }
      .axis {
        opacity: 0.5;
      }
      .tick {
        font-size: 10px;
        font-family: var(--font-mono);
      }
      .divider {
        stroke: var(--border-strong);
        stroke-dasharray: 2 4;
      }
      .pad {
        cursor: pointer;
        outline: none;
        transition: opacity 0.15s ease;
      }
      .pad.low {
        opacity: 0.6;
      }
      .pad.dim {
        opacity: 0.35;
      }
      .ring {
        fill: none;
        stroke: transparent;
        stroke-width: 3;
      }
      .ring.on {
        stroke: var(--accent);
      }
      .pad:focus-visible .ring {
        stroke: var(--accent);
        stroke-width: 4;
      }
      .leaf {
        fill: var(--leaf);
        stroke: var(--leaf-line);
        stroke-width: 2;
      }
      .tag {
        fill: var(--tag-bg);
        stroke: var(--border);
      }
      .tag.on {
        stroke: var(--accent);
        stroke-width: 2;
      }
      .tag-sym {
        font-size: 11px;
        font-weight: 700;
        font-family: var(--font-mono);
        fill: var(--tag-ink);
      }
      .tag-sub {
        font-size: 9.5px;
        fill: var(--tag-sub);
      }
      .table-wrap {
        overflow-x: auto;
        padding: 0 22px 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13.5px;
      }
      th,
      td {
        padding: 9px 10px;
        text-align: left;
        border-bottom: 1px solid var(--border-soft);
        white-space: nowrap;
      }
      thead th {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-3);
      }
      .n {
        text-align: right;
      }
      tr.on td {
        background: var(--accent-soft);
      }
      .sym {
        margin-right: 8px;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text);
      }
      .sym:hover {
        color: var(--accent);
      }
      .glyph {
        font-style: normal;
        font-size: 0.8em;
      }
      .none {
        margin: 0;
        padding: 18px 22px;
        border-top: 1px solid var(--border-soft);
      }
      .foot {
        margin: 0;
        padding: 10px 22px 14px;
        font-size: 12px;
        border-top: 1px solid var(--border-soft);
      }
    `,
  ],
})
export class NewsPond {
  /** The stock board, in the page's order (most written about first). */
  readonly rows = input.required<readonly StockSentiment[]>();
  readonly selected = input<number | null>(null);
  readonly pickStock = output<number>();

  readonly view = signal<'pond' | 'table'>('pond');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly zw = ZW;
  protected readonly axis = AXIS;
  protected readonly low = LOW;
  protected readonly zones = ZONES;
  protected readonly frog = FROG;
  protected readonly glyph = MOOD_GLYPH;
  protected readonly label = MOOD_LABEL;
  protected readonly tone = MOOD_TONE;
  protected readonly signed = signed;
  protected readonly ticks = TICKS.map(([v, label]) => ({ x: xOf(v), label, tone: MOOD_TONE[zoneOf(v)] }));

  protected readonly silent = computed(() => this.rows().filter((r) => r.counts.total === 0).map((r) => r.symbol));

  protected readonly pads = computed<Pad[]>(() => {
    const pads = this.rows()
      .filter((r) => r.counts.total > 0)
      .map((r): Pad => {
        const c = r.counts;
        const net = (c.positive - c.negative) / c.total;
        const zone = zoneOf(net);
        const low = c.total < LOW;
        const radius = 12 + Math.sqrt(Math.min(c.total, 100)) * 4.2;
        return {
          id: r.instrumentId,
          symbol: r.symbol,
          name: r.name,
          total: c.total,
          positive: c.positive,
          neutral: c.neutral,
          negative: c.negative,
          net,
          zone,
          low,
          x: xOf(net),
          y: 0,
          r: radius,
          path: '',
          label:
            `${r.symbol}, ${c.total} ${c.total === 1 ? 'headline' : 'headlines'}: ${c.positive} positive, ${c.neutral} neutral, ` +
            `${c.negative} negative. Net ${signed(net)}, ${MOOD_LABEL[zone].toLowerCase()} zone${low ? ', low volume' : ''}. Press to filter.`,
        };
      });
    placeVertically(pads);
    pads.forEach((p, i) => (p.path = padPath(p.x, p.y, p.r, 300 + i * 37)));
    return pads;
  });
}

/**
 * Picks a height for each pad so pads and their tags do not overlap. Biggest
 * first, each takes the free spot nearest the middle of the pond.
 */
function placeVertically(pads: Pad[]): void {
  const box = (p: Pad, y: number) => {
    const half = Math.max(p.r, 36);
    return { l: p.x - half, r: p.x + half, t: y - p.r, b: y + p.r + TAG };
  };
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  for (const p of [...pads].sort((a, b) => b.total - a.total)) {
    const lo = TOP + p.r;
    const hi = AXIS - 8 - p.r - TAG;
    const mid = (lo + hi) / 2;
    const tries: number[] = [];
    for (let d = 0; mid - d >= lo || mid + d <= hi; d += 6) {
      if (mid - d >= lo) tries.push(mid - d);
      if (d > 0 && mid + d <= hi) tries.push(mid + d);
    }
    const clear = (y: number) => {
      const b = box(p, y);
      return placed.every((o) => b.r + 6 < o.l || o.r + 6 < b.l || b.b + 6 < o.t || o.b + 6 < b.t);
    };
    p.y = tries.find(clear) ?? mid;
    placed.push(box(p, p.y));
  }
}
