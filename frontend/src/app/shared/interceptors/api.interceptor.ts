import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Усі запити йдуть на відносний `/api` того ж origin (dev-proxy або Express-проксі в server.ts),
 * тож httpOnly cookie надсилається браузером автоматично. Під час SSR адресу і cookie підставляє
 * SsrApiBackend. Тут — реакція на завершення сесії та тимчасовий пароль.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) return next(req);
  const isServer = isPlatformServer(inject(PLATFORM_ID));

  const router = inject(Router);
  // AuthService залежить від HttpClient — беремо його ліниво, щоб не було циклу DI
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || isServer) return throwError(() => error);
      const isAuthCall = req.url.startsWith('/api/auth/');
      // сесія завершилась (тайм-аут бездіяльності, блокування, зміна пароля на іншому пристрої)
      if (error.status === 401 && !isAuthCall) {
        injector.get(AuthService).markSignedOut();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url, expired: 1 } });
      }
      // тимчасовий пароль ще не змінено
      if (
        error.status === 403 &&
        (error.error as { code?: string } | null)?.code === 'PASSWORD_CHANGE_REQUIRED'
      ) {
        void router.navigate(['/profile']);
      }
      return throwError(() => error);
    }),
  );
};
