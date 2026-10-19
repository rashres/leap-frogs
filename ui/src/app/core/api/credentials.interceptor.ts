import { HttpInterceptorFn } from '@angular/common/http';

/** Always send the session cookie to the API (and allow CSRF cookie reads). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
