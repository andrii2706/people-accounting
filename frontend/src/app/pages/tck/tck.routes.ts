import type { Routes } from '@angular/router';

export const TCK_ROUTES: Routes = [
  {
    path: '',
    title: 'Довідник ТЦК · Військовий облік',
    loadComponent: () =>
      import('./tck-directory/tck-directory.component').then((m) => m.TckDirectoryComponent),
  },
];
