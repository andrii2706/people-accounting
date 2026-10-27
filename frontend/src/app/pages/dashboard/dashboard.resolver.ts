import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { Dashboard } from '../../shared/interfaces/report.interface';
import { ReportsService } from '../../shared/services/reports.service';

/** Dashboard — do not block sign-in if the summary failed to load (the page shows an error). */
export const dashboardResolver: ResolveFn<Dashboard | null> = () =>
  inject(ReportsService)
    .dashboard()
    .pipe(catchError(() => of(null)));
