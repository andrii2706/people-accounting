import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeList } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/**
 * List filters live in query parameters: ?group=G1&search=… The list always holds everyone (dismissed
 * included): the tabs «Усі / Потребують уваги / Відстрочка / Заброньовані / Звільнені» filter it in the browser.
 */
export const employeeListResolver: ResolveFn<EmployeeList | never> = (route) => {
  const q = route.queryParamMap;
  const params: Record<string, string> = { status: 'all' };
  for (const key of ['search', 'group', 'category']) {
    const value = q.get(key);
    if (value) params[key] = value;
  }
  return resolveOr(inject(EmployeesService).list(params), '/') as never;
};
