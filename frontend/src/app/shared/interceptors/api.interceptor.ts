import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AccountService } from '../services/account.service';
import {
  PLAN_REQUIRED,
  SUBSCRIPTION_EXPIRED,
  TERMS_REQUIRED,
} from '../constants/subscription.constants';
import type { ApiError } from '../interfaces/common.interface';
import { redirectOnce } from '../utils/router.utils';
import { isApiUrl } from '../utils/api-url.utils';
import { MODULE_NOT_CONNECTED } from '../../../platform/contracts/session';
import { MODULE_DENIED_URL } from '../constants/auth.constants';

/**
 * All requests go to `api/…` relative to <base href>: «/api/…» when the application has the domain to itself,
 * «/oblik/api/…» behind the gateway of the domain with several applications. Same origin, so the browser sends
 * the httpOnly cookie automatically. During SSR the address and cookie are set by SsrApiBackend.
 * Here — reactions to an ended session and a temporary password.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url)) return next(req);
  const isServer = isPlatformServer(inject(PLATFORM_ID));

  const router = inject(Router);
  // AuthService depends on HttpClient — get it lazily to avoid a DI cycle
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || isServer) return throwError(() => error);
      const isAuthCall = /^\/?api\/auth\//.test(req.url);
      // session ended (idle timeout, lockout, password changed on another device)
      if (error.status === 401 && !isAuthCall) {
        injector.get(AuthService).markSignedOut();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url, expired: 1 } });
      }
      // temporary password not changed yet; the agreement; the plan / the payment
      const code = error.status === 403 ? (error.error as ApiError | null)?.code : undefined;
      if (code === 'PASSWORD_CHANGE_REQUIRED') redirectOnce(router, '/profile');
      // the account has other applications of the domain, not this one — to the portal, it lists them
      if (code === MODULE_NOT_CONNECTED) window.location.assign(MODULE_DENIED_URL);
      if (code === TERMS_REQUIRED) redirectOnce(router, '/account/terms');
      if (code === PLAN_REQUIRED || code === SUBSCRIPTION_EXPIRED) {
        injector.get(AccountService).forget();
        redirectOnce(router, code === PLAN_REQUIRED ? '/account/plans' : '/account/subscription');
      }
      return throwError(() => error);
    }),
  );
};
