import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { ListsReport, OperationalReport } from '../../../shared/interfaces/report.interface';
import { ReportsService } from '../../../shared/services/reports.service';
import { todayIso } from '../../../shared/utils/date.utils';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Report date — in the ?date=YYYY-MM-DD query parameter (today by default). */
const reportDate = (date: string | null) =>
  date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();

export const listsReportResolver: ResolveFn<ListsReport> = (route) =>
  resolveOr(
    inject(ReportsService).lists(reportDate(route.queryParamMap.get('date'))),
    '/',
  ) as never;

export const operationalReportResolver: ResolveFn<OperationalReport> = (route) =>
  resolveOr(
    inject(ReportsService).operational(reportDate(route.queryParamMap.get('date'))),
    '/',
  ) as never;
