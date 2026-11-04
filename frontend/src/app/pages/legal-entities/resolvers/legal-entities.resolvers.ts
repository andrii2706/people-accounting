import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import type {
  LegalEntityPageData,
  LegalEntitySummary,
} from '../../../shared/interfaces/legal-entity.interface';
import { LegalEntitiesService } from '../../../shared/services/legal-entities.service';
import { OrganizationService } from '../../../shared/services/organization.service';
import { NO_PEOPLE } from '../../../shared/constants/legal-entity.constants';
import { resolveOr } from '../../../shared/utils/router.utils';

export const legalEntitiesResolver: ResolveFn<LegalEntitySummary[]> = () =>
  resolveOr(inject(LegalEntitiesService).list(), '/') as never;

/** The form: the entity (none for «new»), the accounts of its head and responsible person, the e-mail status. */
export const legalEntityPageResolver: ResolveFn<LegalEntityPageData> = (route) => {
  const id = route.paramMap.get('id');
  const service = inject(LegalEntitiesService);
  return resolveOr(
    forkJoin({
      entity: id ? service.get(id) : of(null),
      people: id ? service.people(id) : of(NO_PEOPLE),
      status: inject(OrganizationService).notificationStatus(id ?? ''),
    }),
    '/settings',
  ) as never;
};
