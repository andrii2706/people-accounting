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
 * HTTP-бекенд лише для SSR: запити на `/api/*` спрямовує на внутрішню адресу API
 * і пересилає cookie вхідного запиту — сторінка рендериться від імені того самого користувача.
 *
 * Це саме бекенд, а не інтерсептор: інтерсептори (зокрема кеш передачі стану SSR → браузер)
 * бачать незмінний відносний URL без cookie, тож ключі кешу на сервері й у браузері збігаються
 * і браузер не повторює запити, вже виконані під час SSR.
 */
@Injectable()
export class SsrApiBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);
  private readonly apiBase = inject(API_INTERNAL_URL);
  private readonly incoming = inject(REQUEST, { optional: true });

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    // URL може бути вже абсолютним (Angular SSR доповнює відносні адреси origin-ом сторінки)
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
