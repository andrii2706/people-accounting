import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Authenticated users only; otherwise — to sign-in with a return URL. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Administrators only. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user?.role === 'ADMIN' ? true : router.createUrlTree(['/']);
};

/** Sign-in page — only for users who are not signed in. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user ? router.createUrlTree(['/']) : true;
};

/** Until the temporary password is changed only the profile (password change) is available. */
export const passwordChangeGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  if (!user?.mustChangePassword || state.url.startsWith('/profile')) return true;
  return router.createUrlTree(['/profile']);
};
