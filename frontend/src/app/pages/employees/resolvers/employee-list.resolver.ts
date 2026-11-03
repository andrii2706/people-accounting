import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeList } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { EMPLOYEE_LIST_STATUSES } from '../../../shared/constants/employee.constants';
import { resolveOr } from '../../../shared/utils/router.utils';

/** List filters live in query parameters: ?status=all&group=G1&search=… */
export const employeeListResolver: ResolveFn<EmployeeList | never> = (route) => {
  const q = route.queryParamMap;
  // The URL can be edited by hand — an unknown value must not break the page
  const status = q.get('status')?.toLowerCase();
  const params: Record<string, string> = {
    status: status && EMPLOYEE_LIST_STATUSES.has(status) ? status : 'active',
  };
  for (const key of ['search', 'group', 'category']) {
    const value = q.get(key);
    if (value) params[key] = value;
  }
  return resolveOr(inject(EmployeesService).list(params), '/') as never;
};
