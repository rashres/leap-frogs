import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageMascot, type MascotName } from './page-mascot';

/** Page title row: optional mascot, title, subtitle, and projected actions on the right. */
@Component({
  selector: 'leap-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageMascot],
  template: `
    <div class="head">
      <div class="titled">
        @if (mascot(); as m) {
          <leap-page-mascot [name]="m" />
        }
        <div class="text">
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="sub">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 14px 20px;
        margin-bottom: 22px;
      }
      .titled {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      h1 {
        font-size: 24px;
        font-weight: 750;
        letter-spacing: -0.01em;
      }
      .sub {
        margin: 4px 0 0;
        color: var(--text-2);
        font-size: 13.5px;
        max-width: 640px;
      }
      .actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      .actions:empty {
        display: none;
      }
    `,
  ],
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly mascot = input<MascotName>();
}
