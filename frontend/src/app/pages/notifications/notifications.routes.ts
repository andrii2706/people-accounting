import type { Routes } from '@angular/router';
import { pendingChangesResolver } from './resolvers/pending-changes.resolver';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Повідомлення ТЦК · Військовий облік',
    resolve: { pending: pendingChangesResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./pending-changes/pending-changes.component').then((m) => m.PendingChangesComponent),
  },
];
