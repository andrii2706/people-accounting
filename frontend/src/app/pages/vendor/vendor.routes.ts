import type { Routes } from '@angular/router';
import { billingRecordResolver } from './resolvers/billing-record.resolver';
import {
  billingSettingsResolver,
  vendorSubscriptionsResolver,
} from './resolvers/vendor-billing.resolvers';

export const VENDOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./vendor-layout/vendor-layout.component').then((m) => m.VendorLayoutComponent),
    children: [
      {
        path: '',
        title: 'Оплата за користування · Військовий облік',
        resolve: { record: billingRecordResolver },
        loadComponent: () =>
          import('./billing-settings/billing-settings.component').then(
            (m) => m.BillingSettingsComponent,
          ),
      },
      {
        path: 'subscriptions',
        title: 'Підписки й рахунки · Військовий облік',
        resolve: { data: vendorSubscriptionsResolver },
        runGuardsAndResolvers: 'always',
        loadComponent: () =>
          import('./subscriptions/vendor-subscriptions.component').then(
            (m) => m.VendorSubscriptionsComponent,
          ),
      },
      {
        path: 'pricing',
        title: 'Тарифи та реквізити · Військовий облік',
        resolve: { settings: billingSettingsResolver },
        loadComponent: () => import('./pricing/pricing.component').then((m) => m.PricingComponent),
      },
    ],
  },
];
