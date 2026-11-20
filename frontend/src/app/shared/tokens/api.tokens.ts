import { InjectionToken } from '@angular/core';
import { LOCAL_API_URL } from '../constants/dev.constants';

/**
 * Backend address for requests made during SSR (from the Node process).
 * Set via the API_INTERNAL_URL environment variable in app.config.server.ts.
 */
export const API_INTERNAL_URL = new InjectionToken<string>('API_INTERNAL_URL', {
  providedIn: 'root',
  factory: () => LOCAL_API_URL,
});
