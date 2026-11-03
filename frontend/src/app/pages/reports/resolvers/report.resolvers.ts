import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { ListsReport, OperationalReport } from '../../../shared/interfaces/report.interface';
import { ReportsService } from '../../../shared/services/reports.service';
import { reportDateOrToday } from '../../../shared/utils/date.utils';
import { resolveOr } from '../../../shared/utils/router.utils';

export const listsReportResolver: ResolveFn<ListsReport> = (route) =>
  resolveOr(
    inject(ReportsService).lists(reportDateOrToday(route.queryParamMap.get('date'))),
    '/',
  ) as never;

export const operationalReportResolver: ResolveFn<OperationalReport> = (route) =>
  resolveOr(
    inject(ReportsService).operational(reportDateOrToday(route.queryParamMap.get('date'))),
    '/',
  ) as never;
