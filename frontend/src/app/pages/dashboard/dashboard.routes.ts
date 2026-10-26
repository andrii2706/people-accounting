import type { Routes } from '@angular/router';
import { dashboardResolver } from './dashboard.resolver';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    title: 'Огляд · Військовий облік',
    resolve: { dashboard: dashboardResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
];
