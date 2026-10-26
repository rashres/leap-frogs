/**
 * Inline stroke icons (24px grid, Lucide-style geometry). Kept in-repo so the
 * app takes no icon dependency; every icon is decorative unless given a label.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
  `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const ICONS = {
  portfolio: ['M21.21 15.89A10 10 0 1 1 8 2.83', 'M22 12A10 10 0 0 0 12 2v10z'],
  markets: [
    'M3 3v16a2 2 0 0 0 2 2h16',
    'M9 5v4',
    rect(7, 9, 4, 6, 1),
    'M9 15v2',
    'M17 3v2',
    rect(15, 5, 4, 8, 1),
    'M17 13v3',
  ],
  orders: [
    'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z',
    'M14 8H8',
    'M16 12H8',
    'M13 16H8',
  ],
  news: [
    'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2',
    'M18 14h-8',
    'M15 18h-5',
    'M10 6h8v4h-8V6Z',
  ],
  analytics: ['M3 3v16a2 2 0 0 0 2 2h16', 'M8 17v-4', 'M13 17V9', 'M18 17V5'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  sidebar: [rect(3, 3, 18, 18, 2), 'M9 3v18'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  search: [circle(11, 11, 8), 'm21 21-4.3-4.3'],
  star: ['M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  eye: [
    'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
    circle(12, 12, 3),
  ],
  'eye-off': [
    'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49',
    'M14.084 14.158a3 3 0 0 1-4.242-4.242',
    'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
    'm2 2 20 20',
  ],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  sun: [
    circle(12, 12, 4),
    'M12 2v2',
    'M12 20v2',
    'm4.93 4.93 1.41 1.41',
    'm17.66 17.66 1.41 1.41',
    'M2 12h2',
    'M20 12h2',
    'm6.34 17.66-1.41 1.41',
    'm19.07 4.93-1.41 1.41',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  clock: [circle(12, 12, 10), 'M12 6v6l4 2'],
  wallet: [
    'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
    'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  ],
  'trending-up': ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  'trending-down': ['m22 17-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  layers: ['m12 2 10 5-10 5L2 7l10-5Z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  dollar: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  alert: [circle(12, 12, 10), 'M12 8v4', 'M12 16h.01'],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  globe: [circle(12, 12, 10), 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  check: ['M20 6 9 17l-5-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  copy: [rect(8, 8, 14, 14, 2), 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', circle(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  user: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', circle(9, 7, 4)],
  'shield-check': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'leap-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
        line-height: 0;
      }
    `,
  ],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly stroke = input(1.8);
  readonly filled = input(false);

  readonly paths = computed<readonly string[]>(() => ICONS[this.name()]);
}
