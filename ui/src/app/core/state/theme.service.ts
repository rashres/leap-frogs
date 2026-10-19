import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'leap.ui.theme';

export type Theme = 'light' | 'dark';

/** Light / dark preference shared by the console shell and the login page. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    document.documentElement.dataset['theme'] === 'dark' || readStored(THEME_KEY) === 'dark' ? 'dark' : 'light',
  );

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    if (next === 'dark') document.documentElement.dataset['theme'] = 'dark';
    else delete document.documentElement.dataset['theme'];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#000000' : '#f4f6fa');
    writeStored(THEME_KEY, next);
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage disabled: the preference just lasts for this visit. */
  }
}
