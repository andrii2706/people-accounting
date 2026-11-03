import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { of } from 'rxjs';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** «Копіювати»: /employees/new?copy=<id> — the card to prefill the new one from; null for an empty form. */
export const employeeCopyResolver: ResolveFn<EmployeeDetails | null> = (route) => {
  const id = route.queryParamMap.get('copy');
  if (!id) return of(null);
  return resolveOr(inject(EmployeesService).details(id), '/employees/new') as never;
};
