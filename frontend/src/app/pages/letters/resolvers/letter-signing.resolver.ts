import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { SigningConfig, SigningState } from '../../../shared/interfaces/signature.interface';
import { SignaturesService } from '../../../shared/services/signatures.service';
import { resolveOr } from '../../../shared/utils/router.utils';

/** E-signing state of the letter (frozen document + signatures) — in parallel with the letter data. */
export const letterSigningResolver: ResolveFn<SigningState> = (route) =>
  resolveOr(inject(SignaturesService).state(route.paramMap.get('id')!), '/letters') as never;

/** E-signature settings (IIT widget) — cached by the service, requested once per session. */
export const signingConfigResolver: ResolveFn<SigningConfig> = () =>
  resolveOr(inject(SignaturesService).config(), '/letters') as never;
