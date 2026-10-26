import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Лише для автентифікованих; інакше — на вхід з поверненням назад. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Лише для адміністратора. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user?.role === 'ADMIN' ? true : router.createUrlTree(['/']);
};

/** Сторінка входу — лише для тих, хто ще не увійшов. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  return user ? router.createUrlTree(['/']) : true;
};

/** Поки тимчасовий пароль не змінено — доступний лише профіль (зміна пароля). */
export const passwordChangeGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  if (!user?.mustChangePassword || state.url.startsWith('/profile')) return true;
  return router.createUrlTree(['/profile']);
};
