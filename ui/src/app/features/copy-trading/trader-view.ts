import type { CopyTrader } from '../../core/api/models';
import { formatSignedPct, formatSignedUsd, formatUsd } from '../../shared/format';
import type { PricePoint } from '../../shared/price-chart';

export type Tone = 'up' | 'down' | 'neutral';

/** One number in a trader's metrics grid. */
export interface Metric {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
  /** What the number means, shown on hover. */
  readonly hint: string;
}

const RISK_LABELS: Record<CopyTrader['riskLevel'], string> = { LOW: 'Low risk', MEDIUM: 'Medium risk', HIGH: 'High risk' };
const RISK_TONES: Record<CopyTrader['riskLevel'], string> = { LOW: 'up', MEDIUM: 'warn', HIGH: 'down' };

export function riskLabel(trader: CopyTrader): string {
  return RISK_LABELS[trader.riskLevel] ?? trader.riskLevel;
}

/** Pill tone suffix: pill-up, pill-warn, pill-down. */
export function riskTone(trader: CopyTrader): string {
  return RISK_TONES[trader.riskLevel] ?? 'muted';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function signTone(value: number | null | undefined): Tone {
  if (value == null || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

/** "Jan 2026". */
export function since(trader: CopyTrader): string {
  return new Date(trader.tradingSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function equitySeries(trader: CopyTrader): PricePoint[] {
  return (trader.equityCurve ?? []).map((p) => ({ at: new Date(p.at), price: p.equity }));
}

/** "$1.2M", "$125.6K", "$950". */
export function compactUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Every headline number for a trader, in the order the grids show them. */
export function traderMetrics(trader: CopyTrader): Metric[] {
  return [
    {
      key: 'pnl',
      label: 'PnL',
      value: formatSignedUsd(trader.pnl),
      tone: signTone(trader.pnl),
      hint: `Profit and loss: equity minus the ${formatUsd(trader.startingCapital)} the trader started with.`,
    },
    {
      key: 'roi',
      label: 'ROI',
      value: formatSignedPct(trader.roi),
      tone: signTone(trader.roi),
      hint: 'Return on investment: PnL as a percent of starting capital.',
    },
    {
      key: 'mdd',
      label: 'MDD',
      value: trader.maxDrawdown == null ? '—' : trader.maxDrawdown === 0 ? '0.00%' : `−${trader.maxDrawdown.toFixed(2)}%`,
      tone: trader.maxDrawdown ? 'down' : 'neutral',
      hint: 'Maximum drawdown: the largest fall from a high point of the equity curve. Smaller is safer.',
    },
    {
      key: 'sharpe',
      label: 'Sharpe ratio',
      value: trader.sharpeRatio == null ? '—' : trader.sharpeRatio.toFixed(2),
      tone: signTone(trader.sharpeRatio),
      hint: 'Return per unit of risk, from daily equity changes over a year. Above 1 is good, above 2 is very good.',
    },
    {
      key: 'aum',
      label: 'AUM',
      value: compactUsd(trader.aum),
      tone: 'neutral',
      hint: `Assets under management: the trader's equity plus ${formatUsd(trader.copierFunds)} allocated by copiers.`,
    },
    {
      key: 'copiers',
      label: 'Copy traders',
      value: String(trader.copiers),
      tone: 'neutral',
      hint: 'Accounts copying this trader right now.',
    },
    {
      key: 'success',
      label: 'Success rate',
      value: trader.successRate == null ? '—' : `${trader.successRate.toFixed(0)}%`,
      tone: 'neutral',
      hint: `Share of the ${trader.closedTrades} closing sells made above the average buy price.`,
    },
    {
      key: 'equity',
      label: 'Equity',
      value: formatUsd(trader.equity),
      tone: 'neutral',
      hint: "Cash plus holdings at today's prices.",
    },
  ];
}
