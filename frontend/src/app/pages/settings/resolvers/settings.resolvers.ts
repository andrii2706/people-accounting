import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import type { ManagedUser } from '../../../shared/interfaces/auth.interface';
import type { OrganizationSettingsData } from '../../../shared/interfaces/organization.interface';
import { OrganizationService } from '../../../shared/services/organization.service';
import { UsersService } from '../../../shared/services/users.service';
import type { LabelSettingsPageData } from '../../../shared/interfaces/label-settings.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import type { EntityDatabasePageData } from '../../../shared/interfaces/entity-database.interface';
import { EntityDatabaseService } from '../../../shared/services/entity-database.service';
import { AccountService } from '../../../shared/services/account.service';
import type { SignupRequestView } from '../../../shared/interfaces/auth.interface';
import { resolveOr } from '../../../shared/utils/router.utils';

/** Several requests of the settings page — in parallel, in one resolver. */
export const organizationSettingsResolver: ResolveFn<OrganizationSettingsData> = () => {
  const service = inject(OrganizationService);
  return resolveOr(
    forkJoin({
      organization: service.organization(),
      status: service.notificationStatus(),
    }),
    '/',
  ) as never;
};

/** Sign-ups of companies with KEP (the main administrator). */
export const signupsResolver: ResolveFn<SignupRequestView[]> = () =>
  resolveOr(inject(AccountService).signups(), '/settings') as never;

export const usersResolver: ResolveFn<ManagedUser[]> = () =>
  resolveOr(inject(UsersService).list(), '/settings') as never;

/** Label settings of a legal entity and its name (for the title). */
export const labelSettingsResolver: ResolveFn<LabelSettingsPageData> = (route) => {
  const id = route.paramMap.get('id')!;
  const service = inject(LegalEntitiesService);
  return resolveOr(
    forkJoin({ page: service.labelSettings(id), entity: service.get(id) }).pipe(
      map(({ page, entity }) => ({
        ...page,
        entityId: entity.id,
        entityName: entity.shortName || entity.fullName,
      })),
    ),
    '/settings',
  ) as never;
};

/** The own database of a legal entity (without the password) and its name. */
export const entityDatabaseResolver: ResolveFn<EntityDatabasePageData> = (route) => {
  const id = route.paramMap.get('id')!;
  return resolveOr(
    forkJoin({
      db: inject(EntityDatabaseService).get(id),
      entity: inject(LegalEntitiesService).get(id),
    }).pipe(
      map(({ db, entity }) => ({
        db,
        entityId: entity.id,
        entityName: entity.shortName || entity.fullName,
      })),
    ),
    '/settings',
  ) as never;
};
