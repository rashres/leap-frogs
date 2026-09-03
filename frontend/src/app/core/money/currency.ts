/**
 * Currency registry with an explicit minor-unit scale per currency.
 *
 * CLAUDE.md: "explicit scale per currency" and "Do not assume a single base
 * currency". Scale lives here so no arithmetic site has to guess it.
 *
 * [chore]
 */

export type CurrencyCode = 'GBP' | 'USD' | 'INR' | 'EUR' | 'JPY' | 'BTC' | 'ETH';

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly symbol: string;
  /** Digits after the decimal point that this currency is denominated in. */
  readonly scale: number;
  readonly name: string;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyDefinition>> = {
  GBP: { code: 'GBP', symbol: '£', scale: 2, name: 'Pound sterling' },
  USD: { code: 'USD', symbol: '$', scale: 2, name: 'US dollar' },
  INR: { code: 'INR', symbol: '₹', scale: 2, name: 'Indian rupee' },
  EUR: { code: 'EUR', symbol: '€', scale: 2, name: 'Euro' },
  // JPY has no minor unit at all — the canonical reason scale cannot be hardcoded to 2.
  JPY: { code: 'JPY', symbol: '¥', scale: 0, name: 'Japanese yen' },
  BTC: { code: 'BTC', symbol: '₿', scale: 8, name: 'Bitcoin' },
  ETH: { code: 'ETH', symbol: 'Ξ', scale: 8, name: 'Ether' },
};

export function currencyOf(code: CurrencyCode): CurrencyDefinition {
  return CURRENCIES[code];
}

export function scaleOf(code: CurrencyCode): number {
  return CURRENCIES[code].scale;
}

export function symbolOf(code: CurrencyCode): string {
  return CURRENCIES[code].symbol;
}
