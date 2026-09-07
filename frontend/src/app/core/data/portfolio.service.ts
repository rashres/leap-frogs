/**
 * Holdings and multi-currency cash read models.
 *
 * PS-03 / Prompt 4: "Cash balance is per currency, so the response is a set of
 * balances, not a number." The cash signal is therefore a map keyed by currency
 * and there is deliberately no single `balance` field anywhere in this service.
 *
 * The one place a single figure IS produced — the portfolio header — converts at
 * an indicative display rate and says so in the UI. No conversion here ever
 * feeds pricing, validation or settlement.
 *
 * [US-12][US-13]
 */

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Decimal } from '../money/decimal';
import { Money, percentChange } from '../money/money';
import type { CurrencyCode } from '../money/currency';
import type { CashBalance, HoldingView, Position } from '../domain/portfolio';
import { policyFor } from '../domain/instrument';
import { MarketDataService } from './market-data.service';
import { DemoStore } from './persistence';
import { DEMO_ACCOUNT_ID, FIXTURE_CASH, FIXTURE_POSITIONS } from './fixtures';

/** Currencies a client can view their consolidated total in. */
export const DISPLAY_CURRENCIES: readonly CurrencyCode[] = ['GBP', 'USD', 'INR'];

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly market = inject(MarketDataService);
  private readonly store = inject(DemoStore);

  /** Previous session's state, if this is a reload. See persistence.ts. */
  private readonly restored = this.store.restorePortfolio();

  readonly accountId = DEMO_ACCOUNT_ID;

  /** [US-12] Holdings, keyed by account and instrument. */
  readonly positions = signal<readonly Position[]>(
    this.restored
      ? this.restored.positions.map((p) => ({ ...p, accountId: DEMO_ACCOUNT_ID }))
      : FIXTURE_POSITIONS.map((seed) => {
          const instrument = this.market.requireInstrument(seed.instrumentId);
          return {
            accountId: DEMO_ACCOUNT_ID,
            instrumentId: seed.instrumentId,
            quantity: Decimal.parse(seed.quantity).rescale(
              policyFor(instrument.classCode).quantityScale,
              'DOWN',
            ),
            averageCost: Money.of(seed.averageCost, instrument.currency),
          };
        }),
  );

  /** [US-13] Cash, keyed by account and currency. A set of balances, never one. */
  readonly cashBalances = signal<readonly CashBalance[]>(
    this.restored
      ? this.restored.cash.map((c) => ({ ...c, accountId: DEMO_ACCOUNT_ID }))
      : FIXTURE_CASH.map((seed) => ({
          accountId: DEMO_ACCOUNT_ID,
          currency: seed.currency,
          available: Money.of(seed.amount, seed.currency),
        })),
  );

  constructor() {
    // Write through whenever holdings or cash change. Deliberately depends only
    // on those two signals, not on quotes, so a price tick does not cause a save.
    effect(() => this.store.savePortfolio(this.positions(), this.cashBalances()));
  }

  /** Currency the consolidated header figure is expressed in. */
  readonly displayCurrency = signal<CurrencyCode>('GBP');

  /** [US-12] Positions joined to live pricing. */
  readonly holdings = computed<readonly HoldingView[]>(() =>
    this.positions()
      .filter((position) => position.quantity.isPositive())
      .map((position) => this.toHoldingView(position))
      .sort((a, b) => b.marketValue.amount.compareTo(a.marketValue.amount)),
  );

  /** Market value per currency — the honest, unconverted view. */
  readonly holdingsValueByCurrency = computed<ReadonlyMap<CurrencyCode, Money>>(() => {
    const totals = new Map<CurrencyCode, Money>();
    for (const holding of this.holdings()) {
      const currency = holding.marketValue.currency;
      const running = totals.get(currency) ?? Money.zero(currency);
      totals.set(currency, running.plus(holding.marketValue));
    }
    return totals;
  });

  /** Consolidated portfolio value (holdings + cash) at indicative display rates. */
  readonly totalValue = computed<Money>(() => {
    const target = this.displayCurrency();
    let total = Money.zero(target);
    for (const holding of this.holdings()) {
      total = total.plus(this.market.convertForDisplay(holding.marketValue, target) ?? Money.zero(target));
    }
    for (const balance of this.cashBalances()) {
      total = total.plus(this.market.convertForDisplay(balance.available, target) ?? Money.zero(target));
    }
    return total;
  });

  /** Consolidated cash across currencies, at indicative display rates. */
  readonly totalCash = computed<Money>(() => {
    const target = this.displayCurrency();
    let total = Money.zero(target);
    for (const balance of this.cashBalances()) {
      total = total.plus(this.market.convertForDisplay(balance.available, target) ?? Money.zero(target));
    }
    return total;
  });

  /** Today's movement on holdings, consolidated at indicative display rates. */
  readonly dayChange = computed<Money>(() => {
    const target = this.displayCurrency();
    let total = Money.zero(target);
    for (const position of this.positions()) {
      if (!position.quantity.isPositive()) continue;
      const quote = this.market.latestQuote(position.instrumentId);
      const move = quote.price.minus(quote.previousClose).timesQuantity(position.quantity, 'HALF_EVEN');
      total = total.plus(this.market.convertForDisplay(move, target) ?? Money.zero(target));
    }
    return total;
  });

  readonly dayChangePercent = computed<Decimal>(() => {
    const change = this.dayChange();
    const opening = this.totalValue().minus(change);
    return percentChange(opening, this.totalValue());
  });

  /** Total unrealised profit or loss, consolidated at indicative display rates. */
  readonly totalUnrealisedPnl = computed<Money>(() => {
    const target = this.displayCurrency();
    let total = Money.zero(target);
    for (const holding of this.holdings()) {
      total = total.plus(this.market.convertForDisplay(holding.unrealisedPnl, target) ?? Money.zero(target));
    }
    return total;
  });

  /** Total book cost of open holdings, consolidated at indicative display rates. */
  readonly totalBookCost = computed<Money>(() => {
    const target = this.displayCurrency();
    let total = Money.zero(target);
    for (const holding of this.holdings()) {
      total = total.plus(this.market.convertForDisplay(holding.bookCost, target) ?? Money.zero(target));
    }
    return total;
  });

  /** Unrealised P/L as a percentage of book cost — the headline "total return". */
  readonly totalReturnPercent = computed<Decimal>(() => {
    const cost = this.totalBookCost();
    return percentChange(cost, cost.plus(this.totalUnrealisedPnl()));
  });

  positionFor(instrumentId: string): Position | undefined {
    return this.positions().find((position) => position.instrumentId === instrumentId);
  }

  /** Quantity currently held, zero when there is no position. */
  heldQuantity(instrumentId: string): Decimal {
    const instrument = this.market.requireInstrument(instrumentId);
    const scale = policyFor(instrument.classCode).quantityScale;
    return this.positionFor(instrumentId)?.quantity ?? Decimal.zero(scale);
  }

  cashFor(currency: CurrencyCode): Money {
    return this.cashBalances().find((b) => b.currency === currency)?.available ?? Money.zero(currency);
  }

  /**
   * Applies a fill's effect on holdings and cash.
   *
   * On the write side this is one database transaction alongside the order state
   * change, the ledger entry, the audit event and the outbox event (US-11/BR-09).
   * Here it is a single synchronous signal update for the same reason: no render
   * can observe cash moved but the position not, or the reverse.
   */
  applyFill(input: {
    instrumentId: string;
    side: 'BUY' | 'SELL';
    quantity: Decimal;
    consideration: Money;
  }): void {
    const { instrumentId, side, quantity, consideration } = input;
    const instrument = this.market.requireInstrument(instrumentId);
    const existing = this.positionFor(instrumentId);

    const nextPositions = [...this.positions()];
    const index = nextPositions.findIndex((p) => p.instrumentId === instrumentId);

    if (side === 'BUY') {
      const previousQuantity = existing?.quantity ?? Decimal.zero(quantity.scale);
      const previousBookCost = existing
        ? existing.averageCost.timesQuantity(previousQuantity, 'HALF_EVEN')
        : Money.zero(instrument.currency);
      const newQuantity = previousQuantity.plus(quantity);
      const newBookCost = previousBookCost.plus(consideration);
      const newAverage = Money.from(
        newBookCost.amount.divide(newQuantity, 6, 'HALF_EVEN'),
        instrument.currency,
        'HALF_EVEN',
      );
      const updated: Position = {
        accountId: this.accountId,
        instrumentId,
        quantity: newQuantity,
        averageCost: newAverage,
      };
      if (index >= 0) nextPositions[index] = updated;
      else nextPositions.push(updated);
    } else {
      if (!existing) throw new Error(`Sell with no position: ${instrumentId}`);
      // Average cost is unchanged by a sale; only the quantity reduces.
      nextPositions[index] = { ...existing, quantity: existing.quantity.minus(quantity) };
    }

    const currency = consideration.currency;
    const nextCash = this.cashBalances().map((balance) =>
      balance.currency === currency
        ? {
            ...balance,
            available:
              side === 'BUY' ? balance.available.minus(consideration) : balance.available.plus(consideration),
          }
        : balance,
    );

    this.positions.set(nextPositions);
    this.cashBalances.set(nextCash);
  }

  private toHoldingView(position: Position): HoldingView {
    const instrument = this.market.requireInstrument(position.instrumentId);
    const quote = this.market.latestQuote(position.instrumentId);
    const marketValue = quote.price.timesQuantity(position.quantity, 'HALF_EVEN');
    const bookCost = position.averageCost.timesQuantity(position.quantity, 'HALF_EVEN');

    return {
      instrumentId: position.instrumentId,
      symbol: instrument.symbol,
      name: instrument.name,
      quantity: position.quantity,
      averageCost: position.averageCost,
      lastPrice: quote.price,
      marketValue,
      bookCost,
      unrealisedPnl: marketValue.minus(bookCost),
      unrealisedPnlPercent: percentChange(bookCost, marketValue),
      dayChangePercent: percentChange(quote.previousClose, quote.price),
    };
  }
}
