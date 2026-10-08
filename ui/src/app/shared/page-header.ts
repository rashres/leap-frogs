/**
 * Page heading block: mascot tile, the page's single <h1>, a projected
 * description line, and an optional projected actions area on the right.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageMascot, type MascotName } from './page-mascot';

@Component({
  selector: 'leap-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageMascot],
  template: `
    <div class="lead">
      @if (mascot(); as name) {
        <span class="tile"><leap-page-mascot [name]="name" [size]="44" /></span>
      }
      <div class="text">
        <h1>{{ heading() }}</h1>
        <p class="desc"><ng-content select="[description]" /></p>
      </div>
    </div>
    <div class="actions"><ng-content select="[actions]" /></div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px 24px;
        margin-bottom: 24px;
      }
      .lead {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
      }
      .tile {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--panel);
        border: 1px solid var(--border-soft);
        box-shadow: var(--shadow-1);
        flex-shrink: 0;
      }
      .text {
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .desc {
        margin: 4px 0 0;
        font-size: 14px;
        color: var(--text-3);
      }
      .desc:empty {
        display: none;
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
      @media (max-width: 640px) {
        h1 {
          font-size: 22px;
        }
        .tile {
          width: 48px;
          height: 48px;
        }
        .actions {
          width: 100%;
        }
      }
    `,
  ],
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly mascot = input<MascotName | null>(null);
}
