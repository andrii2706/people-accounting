import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRoute, type Params, RedirectCommand, Router } from '@angular/router';
import { catchError, EMPTY, type Observable, of } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Wrapper for resolvers: 404 → redirect to the fallback with a message,
 * 401 is handled by the interceptor (navigation is cancelled), anything else — a message and cancellation.
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

/** Re-run the resolvers of the current route (after saving changes). The route needs runGuardsAndResolvers: 'always'. */
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

/** Update query parameters (filters) — this re-runs the list resolver. Empty values are removed from the URL. */
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

/**
 * Input transform for query-parameter inputs: with `withComponentInputBinding` a missing
 * parameter arrives as `undefined`, which would otherwise end up as the text "undefined".
 */
export function orEmpty(value: string | null | undefined): string {
  return value ?? '';
}
