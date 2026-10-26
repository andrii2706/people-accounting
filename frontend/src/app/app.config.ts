import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideSignalFormsConfig } from '@angular/forms/signals';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { apiInterceptor } from './shared/interceptors/api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    // GET-запити, виконані під час SSR, вбудовуються в HTML і не повторюються в браузері.
    // Відповіді API мають Cache-Control: no-store (проти кешування проксі) — для передачі стану
    // це не перешкода: HTML-сторінка сама no-store/private і віддається лише цьому користувачу.
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeNonCacheableRequests: true,
      }),
    ),
    // Єдине підсвічування полів з помилкою в усіх формах (Signal Forms)
    provideSignalFormsConfig({
      classes: {
        'is-invalid': (field) => field.state().invalid() && field.state().touched(),
      },
    }),
  ],
};
