import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * All pages are rendered on the server per request (not prerendered):
 * they are behind authentication and contain personal data of a specific user.
 */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }];
