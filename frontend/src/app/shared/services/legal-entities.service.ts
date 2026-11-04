import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PERSON_TEXT } from '../constants/legal-entity.constants';
import type {
  ChangePersonRequest,
  ChangePersonResult,
  EntityPeople,
  EntityPerson,
  GrantAccessRequest,
  GrantAccessResult,
  RevokeAccessResult,
  LegalEntity,
  LegalEntityBody,
  LegalEntitySummary,
  RegistryCompany,
} from '../interfaces/legal-entity.interface';

/** Legal entities of the client: requisites, head and responsible person for the documents. */
@Injectable({ providedIn: 'root' })
export class LegalEntitiesService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<LegalEntitySummary[]>('/api/legal-entities');
  }

  get(id: string) {
    return this.http.get<LegalEntity>(`/api/legal-entities/${id}`);
  }

  create(body: LegalEntityBody) {
    return firstValueFrom(this.http.post<LegalEntity>('/api/legal-entities', body));
  }

  update(id: string, body: LegalEntityBody) {
    return firstValueFrom(this.http.patch<LegalEntity>(`/api/legal-entities/${id}`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/legal-entities/${id}`));
  }

  people(id: string) {
    return this.http.get<EntityPeople>(`/api/legal-entities/${id}/people`);
  }

  /** Gives the head / the responsible person an account (login = e-mail, temporary password once). */
  grantAccess(id: string, person: EntityPerson, body: GrantAccessRequest) {
    return firstValueFrom(
      this.http.post<GrantAccessResult>(
        `/api/legal-entities/${id}/people/${PERSON_TEXT[person].path}/access`,
        body,
      ),
    );
  }

  revokeAccess(id: string, person: EntityPerson) {
    return firstValueFrom(
      this.http.delete<RevokeAccessResult>(
        `/api/legal-entities/${id}/people/${PERSON_TEXT[person].path}/access`,
      ),
    );
  }

  /** A new head / responsible person — replaces the current details. */
  changePerson(id: string, person: EntityPerson, body: ChangePersonRequest) {
    return firstValueFrom(
      this.http.put<ChangePersonResult>(
        `/api/legal-entities/${id}/people/${PERSON_TEXT[person].path}`,
        body,
      ),
    );
  }

  /** Company data from the free ЄДР service by the code. */
  lookup(edrpou: string) {
    return firstValueFrom(
      this.http.get<RegistryCompany>('/api/legal-entities/lookup', { params: { edrpou } }),
    );
  }
}
