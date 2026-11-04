import type { Routes } from '@angular/router';
import { adminGuard } from '../../shared/guards/auth.guard';
import {
  legalEntitiesResolver,
  legalEntityPageResolver,
} from './resolvers/legal-entities.resolvers';

export const LEGAL_ENTITIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Юридичні особи · Військовий облік',
    resolve: { entities: legalEntitiesResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./legal-entity-list/legal-entity-list.component').then(
        (m) => m.LegalEntityListComponent,
      ),
  },
  {
    path: 'new',
    canActivate: [adminGuard],
    title: 'Нова юридична особа · Військовий облік',
    resolve: { page: legalEntityPageResolver },
    loadComponent: () =>
      import('./legal-entity-form/legal-entity-form.component').then(
        (m) => m.LegalEntityFormComponent,
      ),
  },
  {
    path: ':id',
    canActivate: [adminGuard],
    title: 'Юридична особа · Військовий облік',
    resolve: { page: legalEntityPageResolver },
    loadComponent: () =>
      import('./legal-entity-form/legal-entity-form.component').then(
        (m) => m.LegalEntityFormComponent,
      ),
  },
];
