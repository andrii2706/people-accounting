import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import type { ManagedUser } from '../../../shared/interfaces/auth.interface';
import type {
  Organization,
  ResponsiblePerson,
} from '../../../shared/interfaces/organization.interface';
import { OrganizationService } from '../../../shared/services/organization.service';
import { UsersService } from '../../../shared/services/users.service';
import { resolveOr } from '../../../shared/utils/router.utils';

export interface OrganizationSettingsData {
  organization: Organization;
  responsiblePersons: ResponsiblePerson[];
}

/** Кілька запитів сторінки налаштувань — паралельно, одним резолвером. */
export const organizationSettingsResolver: ResolveFn<OrganizationSettingsData> = () => {
  const service = inject(OrganizationService);
  return resolveOr(
    forkJoin({
      organization: service.organization(),
      responsiblePersons: service.responsiblePersons(),
    }),
    '/',
  ) as never;
};

export const usersResolver: ResolveFn<ManagedUser[]> = () =>
  resolveOr(inject(UsersService).list(), '/settings') as never;
