import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService, type AppRole } from '../api/auth.service';

function ensureSession() {
  const auth = inject(AuthService);
  if (auth.loaded()) return of(auth.me());
  return auth.bootstrap();
}

/** Requires a signed-in user; otherwise send to /login. */
export const requireAuth: CanActivateFn = () => {
  const router = inject(Router);
  return ensureSession().pipe(
    map((me) => {
      if (me) return true;
      return router.createUrlTree(['/login']);
    }),
  );
};

/** Route is only active for the given roles. */
export function requireRoles(...roles: AppRole[]): CanMatchFn {
  return () => {
    const router = inject(Router);
    const auth = inject(AuthService);
    return ensureSession().pipe(
      map((me) => {
        if (!me) return router.createUrlTree(['/login']);
        if (roles.includes(me.role)) return true;
        return router.createUrlTree([me.homePath]);
      }),
    );
  };
}

/** Guest-only login pages: bounce signed-in users home. */
export const guestOnly: CanActivateFn = () => {
  const router = inject(Router);
  return ensureSession().pipe(
    map((me) => {
      if (!me) return true;
      return router.createUrlTree([me.homePath]);
    }),
  );
};
