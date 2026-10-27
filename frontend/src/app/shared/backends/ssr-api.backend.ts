import {
  FetchBackend,
  type HttpBackend,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import { inject, Injectable, REQUEST } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_INTERNAL_URL } from '../tokens/api.tokens';

/**
 * HTTP backend for SSR only: routes `/api/*` requests to the internal API address
 * and forwards the cookie of the incoming request — the page is rendered on behalf of the same user.
 *
 * It is a backend, not an interceptor: interceptors (including the SSR → browser transfer cache)
 * see the unchanged relative URL without the cookie, so cache keys on the server and in the browser match
 * and the browser does not repeat requests already made during SSR.
 */
@Injectable()
export class SsrApiBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);
  private readonly apiBase = inject(API_INTERNAL_URL);
  private readonly incoming = inject(REQUEST, { optional: true });

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    // The URL may already be absolute (Angular SSR prefixes relative URLs with the page origin)
    const { pathname, search } = new URL(req.url, 'http://ssr.local');
    if (!pathname.startsWith('/api/')) return this.fetchBackend.handle(req);
    const cookie = this.incoming?.headers.get('cookie');
    return this.fetchBackend.handle(
      req.clone({
        url: `${this.apiBase}${pathname}${search}`,
        setHeaders: cookie ? { cookie } : {},
      }),
    );
  }
}
