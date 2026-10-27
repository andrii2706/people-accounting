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
    // GET requests made during SSR are embedded into the HTML and not repeated in the browser.
    // API responses carry Cache-Control: no-store (against proxy caching) — for state transfer
    // this is not a problem: the HTML page itself is no-store/private and served only to this user.
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeNonCacheableRequests: true,
      }),
    ),
    // Single highlighting of invalid fields across all forms (Signal Forms)
    provideSignalFormsConfig({
      classes: {
        'is-invalid': (field) => field.state().invalid() && field.state().touched(),
      },
    }),
  ],
};
