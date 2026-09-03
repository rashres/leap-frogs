/**
 * Instruments and their per-class trading rules.
 *
 * CLAUDE.md, "Instrument classes": Equities UK, Equities US, Equities India, FX
 * and Crypto do not share rules. Settlement currency, quantity precision,
 * whether fractional quantities are permitted, and trading hours all differ by
 * class, and it is to be modelled as a strategy per class rather than a tangle
 * of conditionals. This file is the frontend mirror of that strategy.
 *
 * [US-15][US-16]
 */

import { Decimal } from '../money/decimal';
import type { CurrencyCode } from '../money/currency';

export type InstrumentClassCode = 'EQUITIES_UK' | 'EQUITIES_US' | 'EQUITIES_INDIA' | 'FX' | 'CRYPTO';

export interface InstrumentClassPolicy {
  readonly code: InstrumentClassCode;
  readonly label: string;
  readonly shortLabel: string;
  /** Default settlement currency. An FX pair overrides this from its quote leg. */
  readonly settlementCurrency: CurrencyCode;
  /** Maximum digits after the decimal point permitted on an order quantity. */
  readonly quantityScale: number;
  readonly fractionalAllowed: boolean;
  /** Digits the class quotes prices to. FX quotes finer than equities. */
  readonly priceScale: number;
  readonly sessionLabel: string;
  isMarketOpen(at: Date): boolean;
}

/** Weekday index (0 = Sunday) and minutes since midnight, in a given zone. */
function zonedClock(at: Date, timeZone: string): { weekday: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays.indexOf(lookup('weekday'));
  // '24' shows up at midnight in some ICU builds; normalise it to 0.
  const hour = Number(lookup('hour')) % 24;
  return { weekday, minuteOfDay: hour * 60 + Number(lookup('minute')) };
}

/** Monday–Friday session between two wall-clock times in the exchange's own zone. */
function weekdaySession(timeZone: string, openMinute: number, closeMinute: number) {
  return (at: Date): boolean => {
    const { weekday, minuteOfDay } = zonedClock(at, timeZone);
    if (weekday === 0 || weekday === 6) return false;
    return minuteOfDay >= openMinute && minuteOfDay < closeMinute;
  };
}

const hm = (hours: number, minutes: number) => hours * 60 + minutes;

export const INSTRUMENT_CLASS_POLICIES: Readonly<Record<InstrumentClassCode, InstrumentClassPolicy>> = {
  EQUITIES_UK: {
    code: 'EQUITIES_UK',
    label: 'Equities UK',
    shortLabel: 'LSE',
    settlementCurrency: 'GBP',
    quantityScale: 0,
    fractionalAllowed: false,
    priceScale: 2,
    sessionLabel: '08:00–16:30 London, Mon–Fri',
    isMarketOpen: weekdaySession('Europe/London', hm(8, 0), hm(16, 30)),
  },
  EQUITIES_US: {
    code: 'EQUITIES_US',
    label: 'Equities US',
    shortLabel: 'US',
    settlementCurrency: 'USD',
    // US brokers routinely support fractional shares; UK and India here do not.
    quantityScale: 4,
    fractionalAllowed: true,
    priceScale: 2,
    sessionLabel: '09:30–16:00 New York, Mon–Fri',
    isMarketOpen: weekdaySession('America/New_York', hm(9, 30), hm(16, 0)),
  },
  EQUITIES_INDIA: {
    code: 'EQUITIES_INDIA',
    label: 'Equities India',
    shortLabel: 'NSE',
    settlementCurrency: 'INR',
    quantityScale: 0,
    fractionalAllowed: false,
    priceScale: 2,
    sessionLabel: '09:15–15:30 Mumbai, Mon–Fri',
    isMarketOpen: weekdaySession('Asia/Kolkata', hm(9, 15), hm(15, 30)),
  },
  FX: {
    code: 'FX',
    label: 'FX',
    shortLabel: 'FX',
    settlementCurrency: 'USD',
    quantityScale: 2,
    fractionalAllowed: true,
    priceScale: 5,
    sessionLabel: 'Sun 22:00 – Fri 22:00 UTC, continuous',
    isMarketOpen: (at: Date): boolean => {
      // The FX week runs continuously from Sunday evening to Friday evening UTC.
      const { weekday, minuteOfDay } = zonedClock(at, 'UTC');
      if (weekday === 6) return false; // Saturday
      if (weekday === 0) return minuteOfDay >= hm(22, 0); // opens Sunday 22:00
      if (weekday === 5) return minuteOfDay < hm(22, 0); // closes Friday 22:00
      return true;
    },
  },
  CRYPTO: {
    code: 'CRYPTO',
    label: 'Crypto',
    shortLabel: 'Crypto',
    settlementCurrency: 'USD',
    quantityScale: 8,
    fractionalAllowed: true,
    priceScale: 2,
    sessionLabel: '24/7, never closes',
    isMarketOpen: () => true,
  },
};

export function policyFor(code: InstrumentClassCode): InstrumentClassPolicy {
  return INSTRUMENT_CLASS_POLICIES[code];
}

export interface Instrument {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly classCode: InstrumentClassCode;
  /** Currency this instrument prices and settles in; overrides the class default for FX. */
  readonly currency: CurrencyCode;
  readonly exchange: string;
  /** BR: instrument tradeability is a pre-trade validation input. */
  readonly tradeable: boolean;
  /** Set when tradeable is false, e.g. "Suspended pending announcement". */
  readonly suspensionNote?: string;
}

export function settlementCurrencyOf(instrument: Instrument): CurrencyCode {
  return instrument.currency;
}

export function isMarketOpenFor(instrument: Instrument, at: Date = new Date()): boolean {
  return policyFor(instrument.classCode).isMarketOpen(at);
}

/** Smallest tradeable increment for the instrument, e.g. 1 for LSE, 0.00000001 for crypto. */
export function minimumIncrement(instrument: Instrument): Decimal {
  const { quantityScale } = policyFor(instrument.classCode);
  return Decimal.ofUnscaled(1n, quantityScale);
}
