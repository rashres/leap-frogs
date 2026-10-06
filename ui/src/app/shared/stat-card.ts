import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Compact metric tile: label, large value, optional sub line. */
@Component({
  selector: 'leap-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel stat">
      <div class="label">{{ label() }}</div>
      <div [class]="'value num ' + (tone() ?? '')">{{ value() }}</div>
      @if (sub()) {
        <div class="sub">{{ sub() }}</div>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .stat {
        height: 100%;
        padding: 16px 18px;
      }
      .label {
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-3);
      }
      .value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 720;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub {
        margin-top: 4px;
        font-size: 12px;
        color: var(--text-3);
      }
    `,
  ],
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string>();
  /** Optional text tone class: 'up', 'down', 'dim'. */
  readonly tone = input<string>();
}
