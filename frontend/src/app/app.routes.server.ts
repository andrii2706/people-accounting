import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * All pages are rendered on the server per request (not prerendered):
 * they are behind authentication and contain personal data of a specific user.
 * The print pages — only in the browser: they call the print dialog and may get data in the navigation state.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'print/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
