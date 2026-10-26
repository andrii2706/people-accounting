import type { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    title: 'Вхід · Військовий облік',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
];
