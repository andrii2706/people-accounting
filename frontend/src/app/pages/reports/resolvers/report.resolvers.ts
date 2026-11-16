import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import type {
  ListSnapshotReport,
  ListsPageData,
} from '../../../shared/interfaces/list-settings.interface';
import type {
  OperationalReport,
  TckExtractSummary,
} from '../../../shared/interfaces/report.interface';
import { ListsService } from '../../../shared/services/lists.service';
import { ReportsService } from '../../../shared/services/reports.service';
import { reportDateOrToday } from '../../../shared/utils/date.utils';
import { resolveOr } from '../../../shared/utils/router.utils';

const dateOf = (route: ActivatedRouteSnapshot) =>
  reportDateOrToday(route.queryParamMap.get('date'));
const entityOf = (route: ActivatedRouteSnapshot) => route.queryParamMap.get('entity') ?? '';

/**
 * The lists page shows formed lists only: ?snapshot= — the chosen ones, otherwise the latest; none — the page
 * offers «Сформувати».
 */
export const listsPageResolver: ResolveFn<ListsPageData> = (route) => {
  const service = inject(ListsService);
  const wanted = route.queryParamMap.get('snapshot');
  return resolveOr(
    service.snapshots(entityOf(route)).pipe(
      switchMap((snapshots) => {
        const id = snapshots.some((s) => s.id === wanted) ? wanted : snapshots[0]?.id;
        if (!id) return of<ListsPageData>({ snapshots, report: null });
        return service.snapshot(id).pipe(
          catchError(() => of<ListSnapshotReport | null>(null)),
          map((report) => ({ snapshots, report })),
        );
      }),
    ),
    '/',
  ) as never;
};

export const operationalReportResolver: ResolveFn<OperationalReport> = (route) =>
  resolveOr(inject(ReportsService).operational(dateOf(route), entityOf(route)), '/') as never;

/** Extracts: every TCK with the number of people in each list. */
export const extractsResolver: ResolveFn<TckExtractSummary[]> = (route) =>
  resolveOr(inject(ReportsService).extracts(dateOf(route), entityOf(route)), '/') as never;
