import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { SigningConfig, SigningState } from '../../../shared/interfaces/signature.interface';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Стан підписання листа (зафіксований документ + підписи) — паралельно з даними листа. */
export const letterSigningResolver: ResolveFn<SigningState> = (route) =>
  resolveOr(inject(SignaturesService).state(route.paramMap.get('id')!), '/letters') as never;

/** Налаштування КЕП (віджет ІІТ) — кешуються сервісом, запит лише один раз за сесію. */
export const signingConfigResolver: ResolveFn<SigningConfig> = () =>
  resolveOr(inject(SignaturesService).config(), '/letters') as never;
