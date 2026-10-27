import { InjectionToken } from '@angular/core';

/**
 * Backend address for requests made during SSR (from the Node process).
 * Set via the API_INTERNAL_URL environment variable in app.config.server.ts.
 */
export const API_INTERNAL_URL = new InjectionToken<string>('API_INTERNAL_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
