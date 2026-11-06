import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import type { ManagedUser } from '../../../shared/interfaces/auth.interface';
import type { OrganizationSettingsData } from '../../../shared/interfaces/organization.interface';
import { OrganizationService } from '../../../shared/services/organization.service';
import { UsersService } from '../../../shared/services/users.service';
import type { LabelSettingsPageData } from '../../../shared/interfaces/label-settings.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
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
