import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeDetails } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Повна картка працівника — для перегляду й редагування. */
export const employeeDetailsResolver: ResolveFn<EmployeeDetails> = (route) =>
  resolveOr(inject(EmployeesService).details(route.paramMap.get('id')!), '/employees') as never;
