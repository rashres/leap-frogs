import { Injectable, computed, effect, inject, untracked } from '@angular/core';
import { CopyTradingService } from '../api/copy-trading.service';
import { createLoader } from '../api/loader';
import type { CopiedOrder } from '../api/models';
import { OrdersService } from '../api/orders.service';
import { ActiveAccountService } from './active-account.service';

/**
 * Which of the active account's orders were copied from a lead trader, so order
 * lists can label them. Reloads with the account and after every order. If the
 * copy trading API fails, orders simply show unlabelled.
 */
@Injectable({ providedIn: 'root' })
export class CopiedOrdersStore {
  private readonly api = inject(CopyTradingService);
  private readonly orders = inject(OrdersService);
  private readonly account = inject(ActiveAccountService);

  private readonly loader = createLoader(() => this.api.copiedOrders(this.account.activeId()!));

  private readonly byOrderId = computed(() => new Map((this.loader.data() ?? []).map((c) => [c.orderId, c])));

  constructor() {
    effect(() => {
      const id = this.account.activeId();
      this.orders.changes();
      if (id != null) untracked(() => this.loader.reload());
    });
  }

  /** The lead trader an order was copied from, or undefined for the account's own orders. */
  copiedFrom(orderId: number): CopiedOrder | undefined {
    return this.byOrderId().get(orderId);
  }
}
