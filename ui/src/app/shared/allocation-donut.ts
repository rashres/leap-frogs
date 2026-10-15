import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** One slice: `color` is a CSS colour, normally a --series-* token. */
export interface DonutSegment {
  readonly key: string;
  readonly label: string;
  /** Second line in the legend, e.g. the instrument name. */
  readonly sub?: string;
  readonly value: number;
  readonly valueLabel: string;
  readonly color: string;
}

const SIZE = 168;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2 - 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between slices, in px along the ring. */
const GAP = 2;

/**
 * Part-to-whole donut with a legend beside it. Hovering or focusing a slice or
 * legend row highlights it and shows its share in the centre. Keep it to six
 * slices or fewer; fold the rest into "Other" before passing them in.
 */
@Component({
  selector: 'leap-allocation-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="ring">
        <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="summary()">
          <circle class="track" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" [attr.stroke-width]="stroke" />
          @for (arc of arcs(); track arc.key) {
            <circle
              class="arc"
              [class.dim]="active() != null && active() !== arc.key"
              [class.on]="active() === arc.key"
              [attr.cx]="size / 2"
              [attr.cy]="size / 2"
              [attr.r]="radius"
              [attr.stroke]="arc.color"
              [attr.stroke-width]="stroke"
              [attr.stroke-dasharray]="arc.dash"
              [attr.stroke-dashoffset]="arc.offset"
              [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
              (mouseenter)="active.set(arc.key)"
              (mouseleave)="active.set(null)"
            />
          }
        </svg>
        <div class="centre" aria-hidden="true">
          @if (focus(); as f) {
            <span class="c-value num">{{ f.pct }}</span>
            <span class="c-label">{{ f.label }}</span>
            <span class="c-sub num">{{ f.valueLabel }}</span>
          }
        </div>
      </div>

      <ul class="legend">
        @for (arc of arcs(); track arc.key) {
          <li
            tabindex="0"
            [class.dim]="active() != null && active() !== arc.key"
            (mouseenter)="active.set(arc.key)"
            (mouseleave)="active.set(null)"
            (focus)="active.set(arc.key)"
            (blur)="active.set(null)"
          >
            <span class="swatch" [style.background]="arc.color" aria-hidden="true"></span>
            <span class="who">
              <span class="name">{{ arc.label }}</span>
              @if (arc.sub) {
                <span class="sub">{{ arc.sub }}</span>
              }
            </span>
            <span class="nums">
              <span class="pct num">{{ arc.pct }}</span>
              <span class="val num">{{ arc.valueLabel }}</span>
            </span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      /* Wide enough (e.g. stacked under the chart): legend beside the ring. */
      @container (min-width: 460px) {
        .wrap {
          flex-direction: row;
          gap: 32px;
        }
        .legend {
          flex: 1;
          max-width: 420px;
        }
      }
      .ring {
        position: relative;
        flex-shrink: 0;
      }
      svg {
        display: block;
      }
      .track {
        fill: none;
        stroke: var(--panel-3);
      }
      .arc {
        fill: none;
        cursor: pointer;
        transition:
          opacity 0.15s ease,
          stroke-width 0.15s ease;
      }
      .arc.on {
        stroke-width: 24px;
      }
      .arc.dim,
      li.dim {
        opacity: 0.4;
      }
      .centre {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        pointer-events: none;
        padding: 0 34px;
      }
      .c-value {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text);
      }
      .c-label {
        max-width: 100%;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .c-sub {
        font-size: 11.5px;
        color: var(--text-3);
      }
      .legend {
        width: 100%;
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: default;
        transition:
          opacity 0.15s ease,
          background-color 0.15s ease;
      }
      li:hover,
      li:focus-visible {
        background: var(--panel-hover);
        outline: none;
      }
      .swatch {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
      .who {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }
      .sub {
        font-size: 11.5px;
        color: var(--text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nums {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .pct {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }
      .val {
        font-size: 11.5px;
        color: var(--text-3);
      }
    `,
  ],
})
export class AllocationDonut {
  readonly segments = input.required<readonly DonutSegment[]>();
  /** Shown in the centre when nothing is hovered. */
  readonly idleLabel = input('Total');
  readonly idleValue = input('');
  readonly idleSub = input('');

  protected readonly size = SIZE;
  protected readonly stroke = STROKE;
  protected readonly radius = RADIUS;

  readonly active = signal<string | null>(null);

  readonly arcs = computed(() => {
    const segments = this.segments().filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) return [];
    const gap = segments.length > 1 ? GAP : 0;
    let start = 0;
    return segments.map((s) => {
      const share = s.value / total;
      const length = Math.max(share * CIRCUMFERENCE - gap, 0.5);
      const arc = {
        ...s,
        pct: `${(share * 100).toFixed(1)}%`,
        dash: `${length} ${CIRCUMFERENCE - length}`,
        offset: -start,
      };
      start += share * CIRCUMFERENCE;
      return arc;
    });
  });

  readonly focus = computed(() => {
    const key = this.active();
    const arc = this.arcs().find((a) => a.key === key);
    if (arc) return { pct: arc.pct, label: arc.label, valueLabel: arc.valueLabel };
    return { pct: this.idleValue(), label: this.idleLabel(), valueLabel: this.idleSub() };
  });

  readonly summary = computed(() =>
    'Allocation: ' + this.arcs().map((a) => `${a.label} ${a.pct}`).join(', '),
  );
}
