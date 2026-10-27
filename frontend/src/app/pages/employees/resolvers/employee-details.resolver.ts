import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Full employee card — for viewing and editing. */
export const employeeDetailsResolver: ResolveFn<EmployeeDetails> = (route) =>
  resolveOr(inject(EmployeesService).details(route.paramMap.get('id')!), '/employees') as never;
