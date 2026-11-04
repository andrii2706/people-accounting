import type { Routes } from '@angular/router';
import { billingRecordResolver } from './resolvers/billing-record.resolver';

export const VENDOR_ROUTES: Routes = [
  {
    path: '',
    title: 'Оплата за користування · Військовий облік',
    resolve: { record: billingRecordResolver },
    loadComponent: () =>
      import('./billing-settings/billing-settings.component').then(
        (m) => m.BillingSettingsComponent,
      ),
  },
];
