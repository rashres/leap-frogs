/**
 * The LEAP frog, in the costume that suits the page.
 *
 * The only bitmap assets in the app. Everything else — instrument marks, icons
 * — is inline SVG (see brand.ts), because a redrawn third-party logo is worse
 * than a monogram. These are different: original artwork for this product, so
 * there is nothing to license and nothing to get subtly wrong.
 *
 * The header mark in app.html stays constant on purpose. That one is the
 * "click for home" anchor, and an anchor that changes on every route stops
 * being one. This is decoration next to a page title, which is free to vary.
 *
 * [chore]
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MascotName = 'portfolio' | 'markets' | 'news' | 'orders';

/** Alt text per costume. Empty would be wrong: the frog is the product's face. */
const ALT: Record<MascotName, string> = {
  portfolio: 'The LEAP frog',
  markets: 'The LEAP frog holding a coin',
  news: 'The LEAP frog reading a newspaper',
  orders: 'The LEAP frog carrying a parcel',
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
      loading="lazy"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      .mascot {
        /* Square box, art centred inside it. The four files differ in aspect
           ratio, so contain keeps them the same visual size as each other. */
        object-fit: contain;
        user-select: none;
        /* Hold the box under pressure: as a flex item the img would otherwise
           squash when the heading runs out of room. */
        flex-shrink: 0;
      }
    `,
  ],
})
export class PageMascot {
  readonly name = input.required<MascotName>();
  /** Rendered edge length in px. Files are 320px, so 2x stays crisp. */
  readonly size = input(56);

  protected readonly ALT = ALT;
}
