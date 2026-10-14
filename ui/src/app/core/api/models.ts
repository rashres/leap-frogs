/**
 * Shapes returned by the Spring Boot API (`/api`). Each interface mirrors a
 * DTO in src/main/java/com/neueda/leap/controllers/dto. BigDecimal fields
 * arrive as JSON numbers.
 */

/** GET /api */
export interface ApiInfo {
  service: string;
  version: string;
  status: string;
  documentation: string;
  openapi: string;
}

/** GET /api/health (200 when UP, 503 when the database is down). */
export interface Health {
  status: 'UP' | 'DOWN';
  service: string;
  timestamp: number;
  database: 'UP' | 'DOWN';
}

/** AccountResponse */
export interface Account {
  accountId: number;
  name: string;
  email: string;
  cashBalance: number;
}

/** InstrumentResponse. lastPrice is in USD, or null until the price fetcher has run. */
export interface Instrument {
  instrumentId: number;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  lastPrice?: number | null;
  priceUpdatedAt?: string | null;
}

/** GET /api/instruments/{id}/prices?range=… */
export type PriceRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All';

/** PricePointResponse */
export interface PricePointDto {
  observedAt: string;
  price: number;
}

/** PortfolioValuePointResponse */
export interface PortfolioValuePointDto {
  at: string;
  totalValue: number;
  cash: number;
  holdingsValue: number;
}

/** HoldingResponse */
export interface Holding {
  instrumentId: number;
  symbol: string;
  instrumentName: string;
  exchange: string;
  country: string;
  quantity: number;
}

/** WatchlistResponse: starred instrument ids, in display order. */
export interface Watchlist {
  accountId: number;
  instrumentIds: number[];
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'CREATED' | 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
/** MARKET fills at the market price; LIMIT only at limitPrice or better. */
export type OrderType = 'MARKET' | 'LIMIT';
/** DAY expires at the close of its trading session; GTC (limit only) waits until filled or cancelled. */
export type TimeInForce = 'DAY' | 'GTC';

/** OrderResponse */
export interface Order {
  orderId: number;
  accountId: number;
  instrumentId: number;
  symbol: string;
  side: OrderSide;
  quantity: number;
  /** The fill price once COMPLETE; while PENDING, the market price when it was placed. */
  price: number;
  value: number;
  status: OrderStatus;
  placedTime: string;
  fulfilledTime: string | null;
  orderType: OrderType;
  limitPrice: number | null;
  timeInForce: TimeInForce;
  /** When a pending DAY order expires; null for GTC and for orders that never waited. */
  expiresAt: string | null;
  /** Rejection reason; only set on the response to a rejected POST. */
  message: string | null;
}

/** OrderRequest. Leaving out the last three places a market order good for the day. */
export interface OrderRequest {
  instrumentId: number;
  side: OrderSide;
  quantity: number;
  orderType?: OrderType;
  limitPrice?: number | null;
  timeInForce?: TimeInForce;
}

/** GET /api/audit/orders */
export interface AuditOrderPage {
  orders: Order[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface AuditOrderQuery {
  accountId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  size?: number;
}

/** ErrorResponse, returned by every endpoint on failure. */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors?: Record<string, string>;
}
