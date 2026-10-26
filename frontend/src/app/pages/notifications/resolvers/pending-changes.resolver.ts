import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { PendingChange } from '../../../shared/interfaces/employee.interface';
import { EmployeesService } from '../../../shared/services/employees.service';
import { resolveOr } from '../../../shared/utils/router.utils';

export const pendingChangesResolver: ResolveFn<PendingChange[]> = () =>
  resolveOr(inject(EmployeesService).pendingChanges(), '/') as never;
