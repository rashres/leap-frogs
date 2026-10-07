import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from './models';

/** A failed API call, normalised so every page handles errors the same way. */
export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the API could not be reached at all. */
    readonly status: number,
    /** Short label, e.g. "Not Found". */
    readonly title: string,
    message: string,
    readonly fieldErrors: Readonly<Record<string, string>> = {},
    /** Raw response body, for endpoints that return data with an error status (e.g. 422 orders). */
    readonly body: unknown = null,
  ) {
    super(message);
  }

  get unreachable(): boolean {
    return this.status === 0;
  }
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  // Rejected orders also carry "status" and "message", so check the full ErrorResponse shape.
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return typeof b['status'] === 'number' && typeof b['error'] === 'string' && typeof b['path'] === 'string';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError(0, 'API unreachable', 'Cannot reach the API. Is the Spring Boot app running on port 8081?');
    }
    // The dev proxy answers 504 (or 502) when nothing is listening on the target port.
    if ((error.status === 502 || error.status === 504) && !isErrorResponse(error.error)) {
      return new ApiError(0, 'API unreachable', 'The dev proxy could not reach the API. Is the Spring Boot app running on port 8081?');
    }
    if (isErrorResponse(error.error)) {
      const body = error.error;
      return new ApiError(body.status, body.error, body.message, body.fieldErrors ?? {}, body);
    }
    return new ApiError(error.status, error.statusText || 'Error', `Request failed with status ${error.status}.`, {}, error.error);
  }
  return new ApiError(-1, 'Unexpected error', error instanceof Error ? error.message : String(error));
}

/** Converts every HttpErrorResponse into an ApiError before it reaches a service. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
