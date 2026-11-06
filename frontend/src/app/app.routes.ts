import type { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import {
  authGuard,
  entityAssignedGuard,
  guestGuard,
  passwordChangeGuard,
  staffGuard,
  vendorGuard,
} from './shared/guards/auth.guard';
import { dictionariesResolver } from './shared/resolvers/dictionaries.resolver';

/**
 * Root routes. Each section is a separate lazy chunk with its own routes file (loadChildren);
 * the main bundle contains only the shell and guards. Page data is loaded by resolvers before the page opens.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // a new password by the link from a letter — works without signing in
    path: 'reset-password',
    title: 'Новий пароль · Військовий облік',
    loadComponent: () =>
      import('./pages/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    // the vendor account: debt for using the system, nothing else
    path: 'vendor',
    canActivate: [vendorGuard],
    loadChildren: () => import('./pages/vendor/vendor.routes').then((m) => m.VENDOR_ROUTES),
  },
  {
    // printing from the browser (envelope labels) — without the menu of the app
    path: 'print',
    canActivate: [authGuard, staffGuard],
    canActivateChild: [passwordChangeGuard, entityAssignedGuard],
    loadChildren: () => import('./pages/print/print.routes').then((m) => m.PRINT_ROUTES),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard, staffGuard],
    canActivateChild: [passwordChangeGuard, entityAssignedGuard],
    resolve: { dictionaries: dictionariesResolver },
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./pages/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'employees',
        loadChildren: () =>
          import('./pages/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./pages/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
      },
      {
        path: 'letters',
        loadChildren: () => import('./pages/letters/letters.routes').then((m) => m.LETTERS_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () => import('./pages/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      // old links: the legal entities live in the settings now
      { path: 'legal-entities', pathMatch: 'full', redirectTo: 'settings' },
      { path: 'legal-entities/:id', redirectTo: 'settings/legal-entities/:id' },
      {
        path: 'tck',
        loadChildren: () => import('./pages/tck/tck.routes').then((m) => m.TCK_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () => import('./pages/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'no-entity',
        title: 'Немає юридичної особи · Військовий облік',
        loadComponent: () =>
          import('./pages/no-entity/no-entity.component').then((m) => m.NoEntityComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
