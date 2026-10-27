import type { Routes } from '@angular/router';
import { organizationSettingsResolver, usersResolver } from './resolvers/settings.resolvers';
import { adminGuard } from '../../shared/guards/auth.guard';

/** Feature module "Settings". */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Налаштування · Військовий облік',
    resolve: { settings: organizationSettingsResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./organization-settings/organization-settings.component').then(
        (m) => m.OrganizationSettingsComponent,
      ),
  },
  {
    path: 'users',
    canActivate: [adminGuard],
    title: 'Користувачі · Військовий облік',
    resolve: { users: usersResolver },
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./users/users.component').then((m) => m.UsersComponent),
  },
];
