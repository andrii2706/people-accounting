import { inject } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import type {
  ListsReport,
  OperationalReport,
  TckExtractSummary,
} from '../../../shared/interfaces/report.interface';
import { ReportsService } from '../../../shared/services/reports.service';
import { reportDateOrToday } from '../../../shared/utils/date.utils';
import { resolveOr } from '../../../shared/utils/router.utils';

const dateOf = (route: ActivatedRouteSnapshot) =>
  reportDateOrToday(route.queryParamMap.get('date'));
const entityOf = (route: ActivatedRouteSnapshot) => route.queryParamMap.get('entity') ?? '';

export const listsReportResolver: ResolveFn<ListsReport> = (route) =>
  resolveOr(inject(ReportsService).lists(dateOf(route), entityOf(route)), '/') as never;

export const operationalReportResolver: ResolveFn<OperationalReport> = (route) =>
  resolveOr(inject(ReportsService).operational(dateOf(route), entityOf(route)), '/') as never;

/** Extracts: every TCK with the number of people in each list. */
export const extractsResolver: ResolveFn<TckExtractSummary[]> = (route) =>
  resolveOr(inject(ReportsService).extracts(dateOf(route), entityOf(route)), '/') as never;
