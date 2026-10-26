import type { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { authGuard, guestGuard, passwordChangeGuard } from './shared/guards/auth.guard';
import { dictionariesResolver } from './shared/resolvers/dictionaries.resolver';

/**
 * Кореневі маршрути. Кожен розділ — окремий lazy-чанк зі своїм файлом маршрутів (loadChildren);
 * у головному бандлі лише каркас (Shell) і гарди. Дані сторінок підвантажують резолвери до відкриття сторінки.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [passwordChangeGuard],
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
      {
        path: 'settings',
        loadChildren: () =>
          import('./pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () => import('./pages/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
