import { InjectionToken } from '@angular/core';

/**
 * Адреса бекенду для запитів під час SSR (з Node-процесу).
 * Задається через змінну середовища API_INTERNAL_URL в app.config.server.ts.
 */
export const API_INTERNAL_URL = new InjectionToken<string>('API_INTERNAL_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
