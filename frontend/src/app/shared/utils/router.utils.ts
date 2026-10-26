import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRoute, type Params, RedirectCommand, Router } from '@angular/router';
import { catchError, EMPTY, type Observable, of } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Обгортка для резолверів: 404 → перенаправлення на fallback з повідомленням,
 * 401 обробляє інтерсептор (скасовуємо навігацію), інше — повідомлення й скасування.
 */
export function resolveOr<T>(
  source: Observable<T>,
  fallback: string,
): Observable<T | RedirectCommand> {
  const router = inject(Router);
  const toast = inject(ToastService);
  return source.pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) return EMPTY;
      toast.error(
        err instanceof HttpErrorResponse && err.status === 404
          ? 'Запис не знайдено'
          : 'Не вдалося завантажити дані',
      );
      return of(new RedirectCommand(router.parseUrl(fallback)));
    }),
  );
}

/** Повторно запустити резолвери поточного маршруту (після збереження змін). Маршрут має runGuardsAndResolvers: 'always'. */
export function injectRouteRefresh() {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  return () =>
    router.navigate([], {
      relativeTo: route,
      queryParamsHandling: 'preserve',
      onSameUrlNavigation: 'reload',
      replaceUrl: true,
    });
}

/** Оновити query-параметри (фільтри) — це перезапускає резолвер списку. Порожні значення прибираються з URL. */
export function injectQueryParamsUpdate() {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  return (params: Params) => {
    const clean: Params = {};
    for (const [k, v] of Object.entries(params))
      clean[k] = v === '' || v === false || v === undefined ? null : v;
    return router.navigate([], {
      relativeTo: route,
      queryParams: clean,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };
}
