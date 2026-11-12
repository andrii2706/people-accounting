import type { Routes } from '@angular/router';
import { termsGuard } from '../../shared/guards/auth.guard';
import { subscriptionResolver, termsResolver } from './resolvers/account.resolvers';

/** The agreement, the plans and the subscription — outside the shell (they work while access is suspended). */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [termsGuard],
    loadComponent: () =>
      import('./account-layout/account-layout.component').then((m) => m.AccountLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'subscription' },
      {
        path: 'terms',
        title: 'Оферта · Військовий облік',
        resolve: { data: termsResolver },
        runGuardsAndResolvers: 'always',
        loadComponent: () => import('./terms/terms.component').then((m) => m.TermsComponent),
      },
      {
        path: 'plans',
        title: 'Тарифи · Військовий облік',
        resolve: { data: subscriptionResolver },
        runGuardsAndResolvers: 'always',
        loadComponent: () => import('./plans/plans.component').then((m) => m.PlansComponent),
      },
      {
        path: 'subscription',
        title: 'Підписка й рахунки · Військовий облік',
        resolve: { data: subscriptionResolver },
        runGuardsAndResolvers: 'always',
        loadComponent: () =>
          import('./subscription/subscription.component').then((m) => m.SubscriptionComponent),
      },
    ],
  },
];
