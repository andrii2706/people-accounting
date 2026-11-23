import type { Routes } from '@angular/router';
import {
  entityDatabaseResolver,
  hrSyncResolver,
  labelSettingsResolver,
  letterheadResolver,
  listSettingsResolver,
  signupsResolver,
  organizationSettingsResolver,
  usersResolver,
} from './resolvers/settings.resolvers';
import {
  legalEntitiesResolver,
  legalEntityPageResolver,
} from '../legal-entities/resolvers/legal-entities.resolvers';
import {
  adminGuard,
  editorGuard,
  entityCreatorGuard,
  managerGuard,
} from '../../shared/guards/auth.guard';

/**
 * Settings: the legal entities (requisites, head, responsible person, quota, reminder addresses, envelope labels),
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
    path: 'legal-entities/:id/letterhead',
    canActivate: [managerGuard],
    title: 'Бланк листа · Військовий облік',
    resolve: { data: letterheadResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./letterhead/letterhead.component').then((m) => m.LetterheadComponent),
  },
  {
    path: 'legal-entities/:id/labels',
    canActivate: [managerGuard],
    title: 'Наклейки на конверти · Військовий облік',
    resolve: { data: labelSettingsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./label-settings/label-settings.component').then((m) => m.LabelSettingsComponent),
  },
  {
    // managers and HR: both prepare the lists
    path: 'legal-entities/:id/lists',
    canActivate: [editorGuard],
    title: 'Вигляд списків · Військовий облік',
    resolve: { data: listSettingsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./list-settings/list-settings.component').then((m) => m.ListSettingsComponent),
  },
  {
    path: 'legal-entities/:id/database',
    canActivate: [managerGuard],
    title: 'Власна база даних · Військовий облік',
    resolve: { data: entityDatabaseResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./entity-database/entity-database.component').then((m) => m.EntityDatabaseComponent),
  },
  {
    // the connection is set by the managers; HR reviews and applies the deliveries (the page shows what is allowed)
    path: 'legal-entities/:id/1c',
    canActivate: [editorGuard],
    title: 'Інтеграція з 1С · Військовий облік',
    resolve: { data: hrSyncResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./hr-sync/hr-sync.component').then((m) => m.HrSyncComponent),
  },
  {
    path: 'system',
    canActivate: [adminGuard],
    title: 'Загальні параметри · Військовий облік',
    resolve: { settings: organizationSettingsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./organization-settings/organization-settings.component').then(
        (m) => m.OrganizationSettingsComponent,
      ),
  },
  {
    path: 'signups',
    canActivate: [adminGuard],
    title: 'Реєстрації компаній · Військовий облік',
    resolve: { rows: signupsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./signups/signups.component').then((m) => m.SignupsComponent),
  },
  {
    path: 'security',
    canActivate: [managerGuard],
    title: 'Безпека · Військовий облік',
    loadComponent: () => import('./security/security.component').then((m) => m.SecurityComponent),
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
