import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { LetterDetails } from '../../../shared/interfaces/letter.interface';
import { LettersService } from '../../../shared/services/letters.service';
import { resolveOr } from '../../../shared/utils/router.utils';

export const letterDetailsResolver: ResolveFn<LetterDetails> = (route) =>
  resolveOr(inject(LettersService).details(route.paramMap.get('id')!), '/letters') as never;
