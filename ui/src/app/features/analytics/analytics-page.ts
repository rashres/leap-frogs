import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import {
  AnalyticsService,
  type AnalyticsFilter,
  type AnalyticsInterval,
} from '../../core/api/analytics.service';
import { createLoader } from '../../core/api/loader';
import { MarketStore } from '../../core/state/market.store';
import { formatStamp, formatUsd } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { InstrumentLogo } from '../../shared/instrument-logo';
import { PageHeader } from '../../shared/page-header';
import { Pager, pageOf } from '../../shared/pager';
import { dayLabel, downloadCsv, isoDay, periodLabel } from './analytics-format';
import { VolumeBars } from './volume-bars';
import { TPipe } from '../../core/i18n/t.pipe';
import { currentLocale, tk, translate } from '../../core/i18n/i18n.service';

type Preset = '30D' | '90D' | 'YTD' | 'ALL';

/** Reporting data older than this gets a warning; the ETL is meant to run every 15 minutes. */
const STALE_AFTER_MS = 30 * 60_000;
/** Rows per page in the instruments and client activity tables. */
const INSTRUMENTS_PER_PAGE = 10;
const MONTHS_PER_PAGE = 12;
const RELOAD_EVERY_MS = 5 * 60_000;

/**
 * Trading activity across all clients, for the commercial analyst. Reads the
 * reporting database through /api/analytics, never the live trading tables.
 */
@Component({
  selector: 'leap-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, PageHeader, Icon, InstrumentLogo, VolumeBars, Pager],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage {
  private readonly api = inject(AnalyticsService);
  private readonly market = inject(MarketStore);

  readonly presets: readonly Preset[] = ['30D', '90D', 'YTD', 'ALL'];
  readonly presetLabels: Record<Preset, string> = { '30D': tk('30 days'), '90D': tk('90 days'), YTD: tk('Year to date'), ALL: tk('All time') };
  readonly intervals: readonly AnalyticsInterval[] = ['day', 'week', 'month'];
  readonly intervalLabels: Record<AnalyticsInterval, string> = { day: tk('Daily'), week: tk('Weekly'), month: tk('Monthly') };

  /** The quick period last picked; null once the dates are edited by hand. */
  readonly preset = signal<Preset | null>('ALL');
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  readonly symbol = signal<string | null>(null);
  readonly instrumentSearch = signal('');
  readonly instrumentSuggestionsOpen = signal(false);
  readonly interval = signal<AnalyticsInterval>('week');

  readonly today = isoDay(new Date());
  readonly rangeError = computed(() => {
    const from = this.from();
    const to = this.to();
    return from && to && from > to ? tk('The start date must be on or before the end date.') : null;
  });

  readonly filter = computed<AnalyticsFilter>(() => ({ from: this.from(), to: this.to(), symbol: this.symbol() }));

  readonly report = createLoader(() => this.api.report(this.filter()));
  readonly volume = createLoader(() => this.api.volume(this.filter(), this.interval()));

  readonly instrumentOptions = computed(() =>
    [...this.market.instruments()].sort((a, b) => a.symbol.localeCompare(b.symbol)).map((i) => ({ symbol: i.symbol, name: i.name })),
  );
  readonly filteredInstrumentOptions = computed(() => {
    const query = this.instrumentSearch().trim().toLocaleLowerCase();
    const options = this.instrumentOptions();
    if (!query) return options;
    return options.filter(({ symbol, name }) =>
      symbol.toLocaleLowerCase().includes(query) || name.toLocaleLowerCase().includes(query),
    );
  });

  /** "1 Jul 2026 – 13 Oct 2026", or "All time". */
  readonly rangeText = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!from && !to) return translate('All time');
    if (!from) return translate('Up to {date}', { date: dayLabel(to!) });
    if (!to) return translate('From {date}', { date: dayLabel(from) });
    return `${dayLabel(from)} – ${dayLabel(to)}`;
  });

  readonly freshness = computed(() => {
    const asOf = this.report.data()?.summary.dataAsOf;
    if (!asOf) return null;
    const age = Date.now() - Date.parse(asOf);
    return {
      text: formatStamp(asOf),
      stale: age > STALE_AFTER_MS,
      minutes: Math.max(0, Math.round(age / 60_000)),
    };
  });

  readonly kpis = computed(() => {
    const data = this.report.data();
    if (!data) return null;
    const s = data.summary;
    const buyShare = s.valueTraded > 0 ? (s.buyValue / s.valueTraded) * 100 : 0;
    return {
      value: formatUsd(s.valueTraded),
      buyValue: formatUsd(s.buyValue),
      sellValue: formatUsd(s.sellValue),
      buyShare,
      trades: s.trades.toLocaleString(currentLocale()),
      buyTrades: s.buyTrades,
      sellTrades: s.sellTrades,
      avgTrade: s.trades > 0 ? formatUsd(s.valueTraded / s.trades) : '—',
      clients: s.activeClients.toLocaleString(currentLocale()),
      perClient: s.activeClients > 0 ? (s.trades / s.activeClients).toFixed(1) : '—',
      instruments: s.instrumentsTraded,
      exchanges: data.markets.length,
      empty: s.trades === 0,
    };
  });

  readonly instrumentRows = computed(() => {
    const data = this.report.data();
    if (!data) return [];
    const total = data.summary.valueTraded;
    return data.instruments.map((row, i) => ({
      ...row,
      rank: i + 1,
      value: formatUsd(row.valueTraded),
      share: total > 0 ? (row.valueTraded / total) * 100 : 0,
    }));
  });

  readonly instrumentsPerPage = INSTRUMENTS_PER_PAGE;
  /** Zero-based; back to the first page whenever the report reloads. */
  readonly instrumentPage = linkedSignal({ source: this.instrumentRows, computation: () => 0 });
  readonly visibleInstruments = computed(() => pageOf(this.instrumentRows(), this.instrumentPage(), INSTRUMENTS_PER_PAGE));

  readonly marketRows = computed(() => {
    const data = this.report.data();
    if (!data) return [];
    const total = data.summary.valueTraded;
    return data.markets.map((m) => ({
      ...m,
      value: formatUsd(m.valueTraded),
      share: total > 0 ? (m.valueTraded / total) * 100 : 0,
    }));
  });

  readonly clientRows = computed(() =>
    (this.report.data()?.clients ?? []).map((c) => ({
      ...c,
      label: periodLabel(c.month, 'month', false),
      value: formatUsd(c.valueTraded),
    })),
  );
  readonly monthsPerPage = MONTHS_PER_PAGE;
  readonly clientPage = linkedSignal({ source: this.clientRows, computation: () => 0 });
  readonly visibleClients = computed(() => pageOf(this.clientRows(), this.clientPage(), MONTHS_PER_PAGE));

  constructor() {
    effect(() => {
      this.filter();
      if (this.rangeError()) return;
      untracked(() => this.report.reload());
    });
    effect(() => {
      this.filter();
      this.interval();
      if (this.rangeError()) return;
      untracked(() => this.volume.reload());
    });
    const timer = setInterval(() => this.reload(), RELOAD_EVERY_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  choosePreset(preset: Preset): void {
    const now = new Date();
    const daysAgo = (n: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    this.preset.set(preset);
    this.to.set(preset === 'ALL' ? null : this.today);
    switch (preset) {
      case '30D':
        this.from.set(daysAgo(29));
        this.interval.set('day');
        break;
      case '90D':
        this.from.set(daysAgo(89));
        this.interval.set('week');
        break;
      case 'YTD':
        this.from.set(`${now.getFullYear()}-01-01`);
        this.interval.set('week');
        break;
      default:
        this.from.set(null);
        this.interval.set('week');
    }
  }

  setFrom(value: string): void {
    this.preset.set(null);
    this.from.set(value || null);
  }

  setTo(value: string): void {
    this.preset.set(null);
    this.to.set(value || null);
  }

  searchInstruments(value: string): void {
    this.instrumentSearch.set(value);
    this.instrumentSuggestionsOpen.set(true);
  }

  setSymbol(value: string): void {
    const query = value.trim();
    if (!query) {
      this.instrumentSearch.set('');
      this.symbol.set(null);
      this.instrumentSuggestionsOpen.set(false);
      return;
    }

    const match = this.instrumentOptions().find((option) =>
      option.symbol.toLocaleLowerCase() === query.toLocaleLowerCase() ||
      option.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
    if (!match) return;

    this.instrumentSearch.set(match.symbol);
    this.symbol.set(match.symbol);
    this.instrumentSuggestionsOpen.set(false);
  }

  reset(): void {
    this.instrumentSearch.set('');
    this.symbol.set(null);
    this.instrumentSuggestionsOpen.set(false);
    this.choosePreset('ALL');
  }

  reload(): void {
    if (this.rangeError()) return;
    this.report.reload();
    this.volume.reload();
  }

  exportInstruments(): void {
    downloadCsv(
      `leap-instruments-${this.fileSuffix()}.csv`,
      [translate('Rank'), translate('Symbol'), translate('Name'), translate('Exchange'), translate('Trades'), translate('Buy trades'), translate('Sell trades'), translate('Clients'), translate('Value traded (USD)'), translate('Share of value (%)')],
      this.instrumentRows().map((r) => [
        r.rank, r.symbol, r.name, r.exchange, r.trades, r.buyTrades, r.sellTrades, r.clients, r.valueTraded, r.share.toFixed(2),
      ]),
    );
  }

  exportVolume(): void {
    downloadCsv(
      `leap-volume-${this.interval()}-${this.fileSuffix()}.csv`,
      [translate('Period start'), translate('Trades'), translate('Buy value (USD)'), translate('Sell value (USD)'), translate('Value traded (USD)')],
      (this.volume.data() ?? []).map((p) => [p.period, p.trades, p.buyValue, p.sellValue, p.valueTraded]),
    );
  }

  exportClients(): void {
    downloadCsv(
      `leap-clients-${this.fileSuffix()}.csv`,
      [translate('Month'), translate('Active clients'), translate('Trades'), translate('Avg trades per client'), translate('Value traded (USD)')],
      (this.report.data()?.clients ?? []).map((c) => [c.month.slice(0, 7), c.activeClients, c.trades, c.avgTradesPerClient, c.valueTraded]),
    );
  }

  /** "2026-07-01_2026-10-13_AAPL" so exported files say what they contain. */
  private fileSuffix(): string {
    const parts = [this.from() ?? 'start', this.to() ?? this.today];
    if (this.symbol()) parts.push(this.symbol()!);
    return parts.join('_');
  }
}
