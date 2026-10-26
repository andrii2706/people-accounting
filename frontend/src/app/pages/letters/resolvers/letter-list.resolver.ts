import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { Letter } from '../../../shared/interfaces/letter.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** ?type=CHANGE_NOTICE&status=DRAFT */
export const letterListResolver: ResolveFn<Letter[]> = (route) => {
  const params: Record<string, string> = {};
  for (const key of ['type', 'status']) {
    const value = route.queryParamMap.get(key);
    if (value) params[key] = value;
  }
  return resolveOr(inject(LettersService).list(params), '/') as never;
};
