import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ENTITY_MANAGER_ROLES } from '../constants/auth.constants';

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

/** The legal entity card and the accounts: the main administrator, the entity administrator, the director. */
export const managerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user && ENTITY_MANAGER_ROLES.includes(user.role)
    ? true
    : router.createUrlTree(['/settings']);
};

/** A new legal entity: the main administrator, or the director while his account has none. */
export const entityCreatorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  return auth.canAddEntity() ? true : router.createUrlTree(['/settings']);
};

/** Pages that change data (new card, editing, import) — every staff role. */
export const editorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  return auth.canEdit() ? true : router.createUrlTree(['/employees']);
};

/**
 * Without a legal entity there is nothing to work with: the director is sent to add his,
 * the others see that the main administrator has to assign them.
 */
export const entityAssignedGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureLoaded();
  if (!auth.needsEntity()) return true;
  const open = ['/profile', '/settings/legal-entities/new', '/no-entity'];
  if (open.some((p) => state.url.startsWith(p))) return true;
  return router.createUrlTree([auth.isDirector() ? '/settings/legal-entities/new' : '/no-entity']);
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
