import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { SentimentLabel, StockSentiment } from '../../core/news/news';
import { Icon } from '../../shared/icon';
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
 *
 * It has no card of its own: the News page puts it inside the sentiment card,
 * passing its title in as [pondTitle] and its stats as the rest of the content.
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

/** Pads lie flat on the water, so they are drawn a little squashed. */
const TILT = 0.86;
const NOTCH = 12;

/**
 * A lily pad seen at a slant: a slightly wavy rim with a narrow slit running
 * into the middle at `rot` degrees, veins fanning out from the centre, and a
 * soft highlight on the side away from the slit. Deterministic for a given rot.
 */
function drawPad(cx: number, cy: number, r: number, rot: number): { outline: string; veins: string; shine: { x: number; y: number } } {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number, dist: number) => [cx + dist * Math.cos(rad(deg)), cy + dist * TILT * Math.sin(rad(deg))] as const;
  const f = (pt: readonly [number, number]) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;

  // The rim, from one side of the slit round to the other, with a gentle wobble.
  const steps = 26;
  const rim = Array.from({ length: steps + 1 }, (_, i) => {
    const deg = rot + NOTCH + (i / steps) * (360 - 2 * NOTCH);
    const wobble = 1 + 0.035 * Math.sin(rad(deg * 5 + rot)) + 0.02 * Math.sin(rad(deg * 11));
    return at(deg, r * wobble);
  });
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  let outline = `M${cx},${cy} L${f(rim[0])}`;
  for (let i = 1; i < rim.length - 1; i++) outline += ` Q${f(rim[i])} ${f(mid(rim[i], rim[i + 1]))}`;
  outline += ` L${f(rim[rim.length - 1])} Z`;

  // Veins fan out between the two edges of the slit; the one opposite it is the longest.
  const veins = Array.from({ length: 9 }, (_, i) => {
    const deg = rot + 36 + i * 36;
    return `M${cx},${cy} L${f(at(deg, r * (i === 4 ? 0.9 : 0.78)))}`;
  }).join(' ');

  const [x, y] = at(rot + 180, r * 0.38);
  return { outline, veins, shine: { x, y } };
}

const COLLAPSED_KEY = 'lilypad.news.pondCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'yes';
  } catch {
    return false;
  }
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
  /** The pad's half-height once tilted. */
  ry: number;
  outline: string;
  veins: string;
  shine: { x: number; y: number };
  label: string;
}

@Component({
  selector: 'leap-news-pond',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <section class="pond" aria-label="The pond: where every stock sits">
      <div class="head">
        <div class="title">
          <ng-content select="[pondTitle]" />
        </div>
        <div class="keys">
          @if (!collapsed()) {
            <span class="key"><i class="pk"></i>Size = headlines</span>
            <span class="key"><i class="pk low"></i>Faded = under {{ low }}</span>
            <div class="segmented" role="group" aria-label="Pond view">
              <button type="button" [class.on]="view() === 'pond'" [attr.aria-pressed]="view() === 'pond'" (click)="view.set('pond')">Pond</button>
              <button type="button" [class.on]="view() === 'table'" [attr.aria-pressed]="view() === 'table'" (click)="view.set('table')">Table</button>
            </div>
          }
          <button type="button" class="btn btn-secondary btn-sm collapse" (click)="toggle()"
                  [attr.aria-expanded]="!collapsed()" aria-controls="pond-body">
            <leap-icon name="chevron-down" [size]="16" class="chev" [class.up]="!collapsed()" />
            {{ collapsed() ? 'Show pond' : 'Hide pond' }}
          </button>
        </div>
      </div>

      <div id="pond-body">
      @if (collapsed()) {
        <!-- Folded away: only the title and the stats below show. -->
      } @else if (pads().length === 0) {
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
                <ellipse class="ripple" [attr.cx]="p.x" [attr.cy]="p.y + 2" [attr.rx]="p.r * 1.16" [attr.ry]="p.ry * 1.16" />
                <ellipse class="shadow" [attr.cx]="p.x + 3" [attr.cy]="p.y + 5" [attr.rx]="p.r" [attr.ry]="p.ry" />
                <ellipse class="ring" [class.on]="selected() === p.id" [attr.cx]="p.x" [attr.cy]="p.y" [attr.rx]="p.r + 6" [attr.ry]="p.ry + 6" />
                <path class="leaf" [attr.d]="p.outline" />
                <path class="vein" [attr.d]="p.veins" />
                <ellipse class="shine" [attr.cx]="p.shine.x" [attr.cy]="p.shine.y" [attr.rx]="p.r * 0.34" [attr.ry]="p.ry * 0.22" />
                <image [attr.href]="frog[p.zone]" [attr.x]="p.x - p.r * 0.575" [attr.y]="p.y - p.r * 0.5 - 2"
                       [attr.width]="p.r * 1.15" [attr.height]="p.r * 0.97" />
                <rect class="tag" [class.on]="selected() === p.id" [attr.x]="p.x - 36" [attr.y]="p.y + p.ry + 8" width="72" height="29" rx="14.5" />
                <text class="tag-sym" [attr.x]="p.x" [attr.y]="p.y + p.ry + 21" text-anchor="middle">{{ p.symbol }}</text>
                <text class="tag-sub" [attr.x]="p.x" [attr.y]="p.y + p.ry + 32" text-anchor="middle">
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
      </div>

      <!-- The page's stats, lined up under the zones. -->
      <ng-content />

      @if (!collapsed()) {
        <p class="foot faint">
          Net tone = (positive − negative) ÷ headlines. Within ±0.10 counts as neutral.
          @if (silent().length > 0) {
            Not shown, no headlines: {{ silent().join(', ') }}.
          }
        </p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        --leaf: #4f8a3a;
        --leaf-line: #2f5e24;
        --vein: #79b25a;
        --tag-bg: #ffffff;
        --tag-ink: #14201a;
        --tag-sub: #3f4d44;
      }
      :host-context([data-theme='dark']) {
        --leaf: #4a8636;
        --leaf-line: #7fb85e;
        --vein: #86c065;
        --tag-bg: #1c1c1c;
        --tag-ink: #f2f2f2;
        --tag-sub: #b3b3b3;
      }
      .title {
        min-width: 0;
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        padding: 20px 24px 16px;
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
        stroke-width: 1.6;
        stroke-linejoin: round;
      }
      .vein {
        fill: none;
        stroke: var(--vein);
        stroke-width: 1.2;
        stroke-linecap: round;
        opacity: 0.7;
      }
      .shine {
        fill: #ffffff;
        opacity: 0.14;
      }
      .shadow {
        fill: #0b2e1a;
        opacity: 0.2;
      }
      .ripple {
        fill: none;
        stroke: var(--leaf-line);
        stroke-width: 1;
        opacity: 0.22;
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
        padding: 0 24px 8px;
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
        padding: 18px 24px;
        border-top: 1px solid var(--border-soft);
      }
      .foot {
        margin: 0;
        padding: 10px 24px 14px;
        font-size: 12px;
        border-top: 1px solid var(--border-soft);
      }
      .collapse {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .chev {
        transition: transform 0.2s ease;
      }
      .chev.up {
        transform: rotate(180deg);
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
  /** Pond folded away, remembered between visits. */
  readonly collapsed = signal(readCollapsed());

  toggle(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? 'yes' : 'no');
    } catch {
      /* Storage disabled: the choice lasts for this visit. */
    }
  }

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
          ry: radius * TILT,
          outline: '',
          veins: '',
          shine: { x: 0, y: 0 },
          label:
            `${r.symbol}, ${c.total} ${c.total === 1 ? 'headline' : 'headlines'}: ${c.positive} positive, ${c.neutral} neutral, ` +
            `${c.negative} negative. Net ${signed(net)}, ${MOOD_LABEL[zone].toLowerCase()} zone${low ? ', low volume' : ''}. Press to filter.`,
        };
      });
    placeVertically(pads);
    pads.forEach((p, i) => Object.assign(p, drawPad(p.x, p.y, p.r, 300 + i * 37)));
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
