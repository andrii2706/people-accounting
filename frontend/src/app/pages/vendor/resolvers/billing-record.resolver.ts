import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import type { BillingRecord } from '../../../shared/interfaces/billing.interface';
import { BillingService } from '../../../shared/services/billing.service';
import { resolveOr } from '../../../shared/utils/router.utils';

export const billingRecordResolver: ResolveFn<BillingRecord> = () =>
  resolveOr(inject(BillingService).record(), '/login');
