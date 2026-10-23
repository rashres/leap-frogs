import { signal } from '@angular/core';
import type { Lang } from './i18n.service';

type Dict = Readonly<Record<string, string>>;
type Other = Exclude<Lang, 'en'>;

/**
 * English text → translation, per language. Keys are the exact English text
 * used in the code; `npm run i18n:check` lists any that are missing. Each
 * language is its own lazy chunk, fetched the first time it is chosen.
 */
const LOADERS: Readonly<Record<Other, () => Promise<{ default: Dict }>>> = {
  es: () => import('./dict/es.json'),
  zh: () => import('./dict/zh.json'),
  hi: () => import('./dict/hi.json'),
  fr: () => import('./dict/fr.json'),
};

const loaded = signal<Partial<Record<Other, Dict>>>({});
const pending = new Set<Other>();

/** The dictionary for a language, or undefined while it is still loading. Reading it re-runs the caller once it arrives. */
export function dictFor(lang: Other): Dict | undefined {
  return loaded()[lang];
}

/** Starts fetching a language's dictionary if it is not loaded yet. */
export function loadDict(lang: Lang): void {
  if (lang === 'en' || loaded()[lang] || pending.has(lang)) return;
  pending.add(lang);
  LOADERS[lang]()
    .then((m) => loaded.update((all) => ({ ...all, [lang]: m.default })))
    .catch(() => {
      /* Offline or the chunk failed: the page stays in English. */
    })
    .finally(() => pending.delete(lang));
}
