import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { translate } from './i18n.service';

/** Route titles are English page names; this shows them as "<name> — LilyPad" in the chosen language. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly page = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const page = this.page();
      this.title.setTitle(page ? `${translate(page)} — LilyPad` : 'LilyPad');
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.page.set(this.buildTitle(snapshot) ?? null);
  }
}
