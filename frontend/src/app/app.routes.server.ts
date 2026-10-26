import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Усі сторінки рендеряться на сервері під час запиту (а не пререндеряться):
 * вони за авторизацією і містять персональні дані конкретного користувача.
 */
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Server }];
