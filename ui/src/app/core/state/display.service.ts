import { Injectable, effect, signal } from '@angular/core';

/** Text size steps. The console is laid out in px, so the steps scale the whole page. */
export type TextSize = 'default' | 'large' | 'larger';

export const TEXT_SCALE: Readonly<Record<TextSize, number>> = { default: 1, large: 1.125, larger: 1.25 };

const SIZE_KEY = 'lilypad.textSize';
const CONTRAST_KEY = 'lilypad.contrast';

/**
 * Reading settings from the accessibility panel: text size and high contrast.
 * Saved per browser and applied to <html>, so every page picks them up.
 */
@Injectable({ providedIn: 'root' })
export class DisplayService {
  readonly textSize = signal<TextSize>(readSize());
  readonly contrast = signal(read(CONTRAST_KEY) === 'on');

  constructor() {
    effect(() => {
      const root = document.documentElement;
      root.style.setProperty('--text-scale', String(TEXT_SCALE[this.textSize()]));
      root.classList.toggle('hc', this.contrast());
      write(SIZE_KEY, this.textSize());
      write(CONTRAST_KEY, this.contrast() ? 'on' : 'off');
    });
  }

  setTextSize(size: TextSize): void {
    this.textSize.set(size);
  }

  setContrast(on: boolean): void {
    this.contrast.set(on);
  }
}

function readSize(): TextSize {
  const v = read(SIZE_KEY);
  return v === 'large' || v === 'larger' ? v : 'default';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage disabled: the setting lasts for this visit. */
  }
}
