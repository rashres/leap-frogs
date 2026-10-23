/**
 * The LEAP frog next to a page title. Artwork and component from the team's
 * Angular app (fe/21-page-mascots, shared/page-mascot.ts).
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MascotName = 'portfolio' | 'markets' | 'news' | 'orders';

const ALT: Record<MascotName, string> = {
  portfolio: 'The LilyPad frog',
  markets: 'The LilyPad frog holding a coin',
  news: 'The LilyPad frog reading a newspaper',
  orders: 'The LilyPad frog carrying a parcel',
};

@Component({
  selector: 'leap-page-mascot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="mascot"
      [src]="'mascot/' + name() + '.png'"
      [alt]="ALT[name()]"
      [width]="size()"
      [height]="size()"
      decoding="async"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      .mascot {
        object-fit: contain;
        user-select: none;
        flex-shrink: 0;
      }
    `,
  ],
})
export class PageMascot {
  readonly name = input.required<MascotName>();
  readonly size = input(52);

  protected readonly ALT = ALT;
}
