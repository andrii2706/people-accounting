import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { ReportsService } from '../../shared/services/reports.service';

/** Огляд — не блокуємо вхід, якщо зведення не завантажилось (сторінка покаже помилку). */
export const dashboardResolver: ResolveFn<Dashboard | null> = () =>
  inject(ReportsService)
    .dashboard()
    .pipe(catchError(() => of(null)));
