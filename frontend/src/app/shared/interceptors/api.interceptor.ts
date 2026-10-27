import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * All requests go to the relative `/api` of the same origin (dev proxy or the Express proxy in server.ts),
 * so the browser sends the httpOnly cookie automatically. During SSR the address and cookie are set by
 * SsrApiBackend. Here — reactions to an ended session and a temporary password.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) return next(req);
  const isServer = isPlatformServer(inject(PLATFORM_ID));

  const router = inject(Router);
  // AuthService depends on HttpClient — get it lazily to avoid a DI cycle
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || isServer) return throwError(() => error);
      const isAuthCall = req.url.startsWith('/api/auth/');
      // session ended (idle timeout, lockout, password changed on another device)
      if (error.status === 401 && !isAuthCall) {
        injector.get(AuthService).markSignedOut();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url, expired: 1 } });
      }
      // temporary password not changed yet
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
