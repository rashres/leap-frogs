/**
 * Trading sessions per market, keyed by the exchange names the API returns.
 * Session hours are adapted from the team's Angular app (fe/21-page-mascots,
 * core/domain/instrument.ts). The API enforces the same hours
 * (services/MarketHours.java): while a market is closed, orders wait as
 * PENDING. Keep the two in step. Open/closed is decided in each exchange's own
 * time zone; the hours are displayed in US Central time.
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

/** Trading hours are shown in the platform's time zone, US Central. */
export const DISPLAY_ZONE = 'America/Chicago';
export const DISPLAY_ZONE_LABEL = 'CT';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTES_PER_DAY = 24 * 60;

/** Minutes the zone's wall clock is ahead of UTC at this instant. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour') % 24, part('minute'));
  return Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** A market's local minute-of-day moved to the display zone, plus how many days it moved. */
function toDisplay(minuteOfDay: number, marketZone: string, at: Date): { minute: number; dayShift: number } {
  const shifted = minuteOfDay + offsetMinutes(at, DISPLAY_ZONE) - offsetMinutes(at, marketZone);
  const dayShift = Math.floor(shifted / MINUTES_PER_DAY);
  return { minute: shifted - dayShift * MINUTES_PER_DAY, dayShift };
}

function clockText(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

const dayName = (weekday: number) => DAYS[(weekday + 7) % 7];
const dayRange = (shift: number) => `${dayName(1 + shift)}–${dayName(5 + shift)}`;

/** Mon–Fri hours in the display zone; offsets are taken now so daylight saving is current. */
function weekdayLabel(marketZone: string, open: number, close: number): string {
  const now = new Date();
  const from = toDisplay(open, marketZone, now);
  const to = toDisplay(close, marketZone, now);
  if (from.dayShift === to.dayShift) {
    return `${clockText(from.minute)}–${clockText(to.minute)} ${DISPLAY_ZONE_LABEL}, ${dayRange(from.dayShift)}`;
  }
  return `${clockText(from.minute)} ${dayRange(from.dayShift)} to ${clockText(to.minute)} ${dayRange(to.dayShift)} ${DISPLAY_ZONE_LABEL}`;
}

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
    get sessionLabel() {
      return weekdayLabel('America/New_York', hm(9, 30), hm(16, 0));
    },
    isOpen: weekdaySession('America/New_York', hm(9, 30), hm(16, 0)),
  },
  EQUITIES_UK: {
    code: 'EQUITIES_UK',
    label: 'Equities UK',
    shortLabel: 'LSE',
    get sessionLabel() {
      return weekdayLabel('Europe/London', hm(8, 0), hm(16, 30));
    },
    isOpen: weekdaySession('Europe/London', hm(8, 0), hm(16, 30)),
  },
  EQUITIES_INDIA: {
    code: 'EQUITIES_INDIA',
    label: 'Equities India',
    shortLabel: 'NSE',
    get sessionLabel() {
      return weekdayLabel('Asia/Kolkata', hm(9, 15), hm(15, 30));
    },
    isOpen: weekdaySession('Asia/Kolkata', hm(9, 15), hm(15, 30)),
  },
  FX: {
    code: 'FX',
    label: 'FX',
    shortLabel: 'FX',
    get sessionLabel() {
      const edge = toDisplay(hm(22, 0), 'UTC', new Date());
      const time = clockText(edge.minute);
      return `${dayName(edge.dayShift)} ${time} – ${dayName(5 + edge.dayShift)} ${time} ${DISPLAY_ZONE_LABEL}, continuous`;
    },
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
