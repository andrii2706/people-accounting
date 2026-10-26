import type { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Мій профіль · Військовий облік',
    loadComponent: () => import('./profile.component').then((m) => m.ProfileComponent),
  },
];
