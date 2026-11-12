import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type {
  BillingSettingsView,
  VendorBillingData,
} from '../../../shared/interfaces/subscription.interface';
import { VendorBillingService } from '../../../shared/services/vendor-billing.service';
import { resolveOr } from '../../../shared/utils/router.utils';

export const billingSettingsResolver: ResolveFn<BillingSettingsView> = () =>
  resolveOr(inject(VendorBillingService).settings(), '/vendor') as never;

export const vendorSubscriptionsResolver: ResolveFn<VendorBillingData> = () => {
  const service = inject(VendorBillingService);
  return resolveOr(
    forkJoin({ subscriptions: service.subscriptions(), invoices: service.invoices() }),
    '/vendor',
  ) as never;
};
