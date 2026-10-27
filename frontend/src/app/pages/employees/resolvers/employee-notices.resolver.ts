import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { EmployeeNotice } from '../../../shared/interfaces/letter.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Notices sent to the TCK about this employee — loaded in parallel with the card. */
export const employeeNoticesResolver: ResolveFn<EmployeeNotice[]> = (route) =>
  resolveOr(
    inject(LettersService).employeeNotices(route.paramMap.get('id')!),
    '/employees',
  ) as never;
