/**
 * Trading sessions per market, keyed by the exchange names the API returns.
 * Session hours are adapted from the team's Angular app (fe/21-page-mascots,
 * core/domain/instrument.ts). They are informational: the API does not
 * enforce trading hours.
 */

export type MarketCode = 'EQUITIES_US' | 'EQUITIES_UK' | 'EQUITIES_INDIA' | 'FX' | 'CRYPTO';

export interface MarketPolicy {
  readonly code: MarketCode;
  readonly label: string;
  readonly shortLabel: string;
  readonly sessionLabel: string;
  isOpen(at: Date): boolean;
}

function zonedClock(at: Date, timeZone: string): { weekday: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(lookup('weekday'));
  // Some ICU builds report midnight as hour 24.
  const hour = Number(lookup('hour')) % 24;
  return { weekday, minuteOfDay: hour * 60 + Number(lookup('minute')) };
}

const hm = (hours: number, minutes: number) => hours * 60 + minutes;

function weekdaySession(timeZone: string, open: number, close: number) {
  return (at: Date): boolean => {
    const { weekday, minuteOfDay } = zonedClock(at, timeZone);
    return weekday !== 0 && weekday !== 6 && minuteOfDay >= open && minuteOfDay < close;
  };
}

export const MARKETS: Readonly<Record<MarketCode, MarketPolicy>> = {
  EQUITIES_US: {
    code: 'EQUITIES_US',
    label: 'Equities US',
    shortLabel: 'US',
    sessionLabel: '09:30–16:00 New York, Mon–Fri',
    isOpen: weekdaySession('America/New_York', hm(9, 30), hm(16, 0)),
  },
  EQUITIES_UK: {
    code: 'EQUITIES_UK',
    label: 'Equities UK',
    shortLabel: 'LSE',
    sessionLabel: '08:00–16:30 London, Mon–Fri',
    isOpen: weekdaySession('Europe/London', hm(8, 0), hm(16, 30)),
  },
  EQUITIES_INDIA: {
    code: 'EQUITIES_INDIA',
    label: 'Equities India',
    shortLabel: 'NSE',
    sessionLabel: '09:15–15:30 Mumbai, Mon–Fri',
    isOpen: weekdaySession('Asia/Kolkata', hm(9, 15), hm(15, 30)),
  },
  FX: {
    code: 'FX',
    label: 'FX',
    shortLabel: 'FX',
    sessionLabel: 'Sun 22:00 – Fri 22:00 UTC, continuous',
    isOpen: (at: Date): boolean => {
      const { weekday, minuteOfDay } = zonedClock(at, 'UTC');
      if (weekday === 6) return false;
      if (weekday === 0) return minuteOfDay >= hm(22, 0);
      if (weekday === 5) return minuteOfDay < hm(22, 0);
      return true;
    },
  },
  CRYPTO: {
    code: 'CRYPTO',
    label: 'Crypto',
    shortLabel: 'Crypto',
    sessionLabel: '24/7, never closes',
    isOpen: () => true,
  },
};

/** Display order for market groups and session dots. */
export const MARKET_ORDER: readonly MarketCode[] = ['EQUITIES_US', 'EQUITIES_UK', 'EQUITIES_INDIA', 'FX', 'CRYPTO'];

const EXCHANGE_MARKET: Readonly<Record<string, MarketCode>> = {
  nasdaq: 'EQUITIES_US',
  nyse: 'EQUITIES_US',
  amex: 'EQUITIES_US',
  lse: 'EQUITIES_UK',
  'london stock exchange': 'EQUITIES_UK',
  nse: 'EQUITIES_INDIA',
  bse: 'EQUITIES_INDIA',
  fx: 'FX',
  forex: 'FX',
  binance: 'CRYPTO',
  coinbase: 'CRYPTO',
  kraken: 'CRYPTO',
};

/** The market an exchange belongs to, or null for an exchange this table does not know. */
export function marketFor(exchange: string): MarketPolicy | null {
  const code = EXCHANGE_MARKET[exchange.trim().toLowerCase()];
  return code ? MARKETS[code] : null;
}
