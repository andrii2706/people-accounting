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

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user?.role === 'ADMIN' ? true : router.createUrlTree(['/']);
};

/** Pages that change data (new card, editing, import) — not for the director. */
export const editorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user?.role === 'ADMIN' || user?.role === 'HR'
    ? true
    : router.createUrlTree(['/employees']);
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

/** The staff area (personal data) — not for the vendor account: it is sent to its payment page. */
export const staffGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user?.role === 'VENDOR' ? router.createUrlTree(['/vendor']) : true;
};

/** The payment page — only for the vendor account. */
export const vendorGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return user.role === 'VENDOR' ? true : router.createUrlTree(['/']);
};
