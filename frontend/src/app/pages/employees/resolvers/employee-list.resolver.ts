import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeList } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

const STATUSES = new Set(['active', 'dismissed', 'all']);

/** Фільтри списку живуть у query-параметрах: ?status=all&group=G1&search=… */
export const employeeListResolver: ResolveFn<EmployeeList | never> = (route) => {
  const q = route.queryParamMap;
  // URL можна відредагувати вручну — невідоме значення не повинно ламати сторінку
  const status = q.get('status')?.toLowerCase();
  const params: Record<string, string> = {
    status: status && STATUSES.has(status) ? status : 'active',
  };
  for (const key of ['search', 'group', 'category']) {
    const value = q.get(key);
    if (value) params[key] = value;
  }
  if (q.get('warnings') === '1') params['withWarnings'] = 'true';
  return resolveOr(inject(EmployeesService).list(params), '/') as never;
};
