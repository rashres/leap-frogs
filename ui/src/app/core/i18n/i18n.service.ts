import { Injectable, computed, signal } from '@angular/core';
import { dictFor, loadDict } from './dict';
import { matchServerMessage } from './server-messages';

/**
 * The interface language. Words are written in English in the code and looked
 * up in DICT (see dict.ts) for the other languages; the shell and Operations
 * home keep their own keyed dictionaries.
 */
export type Lang = 'en' | 'es' | 'zh' | 'hi' | 'fr';

/** Each language named in itself, so a reader can find their own. */
export const LANGUAGES: readonly { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'zh', name: '中文 (简体)' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'fr', name: 'Français' },
];

/** Locale used for dates, times and numbers in each language. */
export const LOCALE: Readonly<Record<Lang, string>> = { en: 'en-US', es: 'es-MX', zh: 'zh-CN', hi: 'hi-IN', fr: 'fr-FR' };

const KEY = 'lilypad.lang';

const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v);

/** Swaps `{name}` placeholders for values: fill('Hi {who}', { who: 'Ana' }). */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** The chosen language. Module-level so plain format helpers can follow it too. */
const current = signal<Lang>(readLang());
loadDict(current());

/** Locale for the chosen language. Reading it inside a template or computed re-runs that code on a language change. */
export function currentLocale(): string {
  return LOCALE[current()];
}

/** Marks English text that is translated later, where it is shown (`{{ x | t }}`), so the checker finds it. */
export const tk = <T extends string>(text: T): T => text;

/** English text in the chosen language, with `{name}` placeholders filled. Unknown text stays in English. */
export function translate(text: string, values?: Readonly<Record<string, string | number>>): string {
  const lang = current();
  if (lang === 'en') return values ? fill(text, values) : text;
  const dict = dictFor(lang);
  if (!dict) return values ? fill(text, values) : text;
  const out = dict[text];
  if (out !== undefined) return values ? fill(out, values) : out;
  const server = matchServerMessage(text);
  if (server) return fill(dict[server.key] ?? server.key, server.values);
  return values ? fill(text, values) : text;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly current = current;

  readonly lang = this.current.asReadonly();
  readonly locale = computed(() => LOCALE[this.current()]);

  constructor() {
    document.documentElement.lang = this.current();
  }

  /** See `translate`. */
  tr(text: string, values?: Readonly<Record<string, string | number>>): string {
    return translate(text, values);
  }

  set(lang: string): void {
    const next = isLang(lang) ? lang : 'en';
    loadDict(next);
    this.current.set(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* Storage disabled: the choice lasts for this visit. */
    }
  }

  /** US dollars in the current language. Outside English the code is shown, since "$" alone is ambiguous. */
  usd(value: number): string {
    const lang = this.current();
    return value.toLocaleString(LOCALE[lang], {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: lang === 'en' ? 'symbol' : 'code',
    });
  }

  /** "Oct 20" in the current language. */
  day(iso: string): string {
    return new Date(iso).toLocaleDateString(this.locale(), { month: 'short', day: 'numeric' });
  }

  /** "1:30 PM" in the current language. */
  time(iso: string | Date): string {
    return new Date(iso).toLocaleTimeString(this.locale(), { hour: 'numeric', minute: '2-digit' });
  }

  /** "Oct 21, 1:31 PM" in the current language. */
  stamp(iso: string): string {
    return new Date(iso).toLocaleString(this.locale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    return isLang(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}
