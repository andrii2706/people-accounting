import type { Routes } from '@angular/router';
import { organizationSettingsResolver, usersResolver } from './resolvers/settings.resolvers';
import {
  legalEntitiesResolver,
  legalEntityPageResolver,
} from '../legal-entities/resolvers/legal-entities.resolvers';
import { entityCreatorGuard, managerGuard } from '../../shared/guards/auth.guard';

/**
 * Settings: the legal entities (requisites, head, responsible person, quota, reminder addresses),
 * the users and the parameters shared by all legal entities.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Налаштування · Військовий облік',
    resolve: { entities: legalEntitiesResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('../legal-entities/legal-entity-list/legal-entity-list.component').then(
        (m) => m.LegalEntityListComponent,
      ),
  },
  {
    path: 'legal-entities/new',
    canActivate: [entityCreatorGuard],
    title: 'Нова юридична особа · Військовий облік',
    resolve: { page: legalEntityPageResolver },
    loadComponent: () =>
      import('../legal-entities/legal-entity-form/legal-entity-form.component').then(
        (m) => m.LegalEntityFormComponent,
      ),
  },
  {
    path: 'legal-entities/:id',
    canActivate: [managerGuard],
    title: 'Юридична особа · Військовий облік',
    resolve: { page: legalEntityPageResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('../legal-entities/legal-entity-form/legal-entity-form.component').then(
        (m) => m.LegalEntityFormComponent,
      ),
  },
  {
    path: 'system',
    title: 'Загальні параметри · Військовий облік',
    resolve: { settings: organizationSettingsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./organization-settings/organization-settings.component').then(
        (m) => m.OrganizationSettingsComponent,
      ),
  },
  {
    path: 'users',
    canActivate: [managerGuard],
    title: 'Користувачі · Військовий облік',
    resolve: { users: usersResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./users/users.component').then((m) => m.UsersComponent),
  },
];
