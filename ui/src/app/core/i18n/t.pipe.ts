import { Pipe, PipeTransform } from '@angular/core';
import { translate } from './i18n.service';

/**
 * `{{ 'Holdings' | t }}` or `{{ 'Orders · {n}' | t: { n: count } }}`.
 * Impure so it re-reads the language signal, which also marks OnPush views for refresh.
 */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(text: string, values?: Readonly<Record<string, string | number>>): string {
    return translate(text, values);
  }
}
