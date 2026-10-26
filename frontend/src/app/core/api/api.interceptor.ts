import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_INTERNAL_URL } from './api.tokens';

/**
 * Усі запити йдуть на відносний `/api`:
 *  - у браузері — той самий origin (dev-proxy або Express-проксі в server.ts), httpOnly cookie надсилається автоматично;
 *  - під час SSR — на внутрішню адресу бекенду з пересиланням cookie вхідного запиту,
 *    тож сервер рендерить сторінку від імені того самого користувача.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) return next(req);

  const isServer = isPlatformServer(inject(PLATFORM_ID));
  let request = req.clone({ withCredentials: true });

  if (isServer) {
    const incoming = inject(REQUEST, { optional: true });
    const cookie = incoming?.headers.get('cookie');
    request = request.clone({
      url: `${inject(API_INTERNAL_URL)}${req.url}`,
      setHeaders: cookie ? { cookie } : {},
    });
  }

  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      const isAuthCheck = req.url.startsWith('/api/auth/');
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthCheck && !isServer) {
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};

/** Людяне повідомлення з помилки API (NestJS повертає message: string | string[]). */
export function apiErrorMessage(error: unknown, fallback = 'Сталася помилка. Спробуйте ще раз.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Сервер недоступний. Перевірте з’єднання.';
    const body = error.error as { message?: string | string[]; errors?: { field: string; message: string }[] } | null;
    // структуровані помилки валідації — лише тексти, без технічних назв полів
    if (body?.errors?.length) return [...new Set(body.errors.map((e) => e.message))].join('; ');
    const message = body?.message;
    if (Array.isArray(message)) return message.join('; ');
    if (message) return message;
  }
  return fallback;
}
