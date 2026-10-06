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

/** InstrumentResponse. Price fields only exist once feature/yfinance is merged. */
export interface Instrument {
  instrumentId: number;
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  lastPrice?: number | null;
  priceUpdatedAt?: string | null;
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

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'CREATED' | 'PENDING' | 'COMPLETE' | 'FAILED';

/** OrderResponse */
export interface Order {
  orderId: number;
  accountId: number;
  instrumentId: number;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  value: number;
  status: OrderStatus;
  placedTime: string;
  fulfilledTime: string | null;
  /** Rejection reason; only set on the response to a rejected POST. */
  message: string | null;
}

/** OrderRequest */
export interface OrderRequest {
  instrumentId: number;
  side: OrderSide;
  quantity: number;
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
