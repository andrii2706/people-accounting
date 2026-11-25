import { HttpClient, httpResource } from '@angular/common/http';
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
  QuotaNotifySettings,
  QuotaPage,
  RegistryCompany,
} from '../interfaces/legal-entity.interface';
import type { AuditEntry } from '../interfaces/employee.interface';
import type { LabelSettings, LabelSettingsPage } from '../interfaces/label-settings.interface';
import type {
  LetterheadSettings,
  LetterheadSettingsPage,
} from '../interfaces/letterhead.interface';

/** Legal entities of the client: requisites, head and responsible person for the documents. */
@Injectable({ providedIn: 'root' })
export class LegalEntitiesService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<LegalEntitySummary[]>('api/legal-entities');
  }

  get(id: string) {
    return this.http.get<LegalEntity>(`api/legal-entities/${id}`);
  }

  create(body: LegalEntityBody) {
    return firstValueFrom(this.http.post<LegalEntity>('api/legal-entities', body));
  }

  update(id: string, body: LegalEntityBody) {
    return firstValueFrom(this.http.patch<LegalEntity>(`api/legal-entities/${id}`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.http.delete<void>(`api/legal-entities/${id}`));
  }

  /** Journal of the entity on demand: who changed the requisites, the head, the responsible person, the access. */
  historyResource(id: () => string | undefined) {
    return httpResource<AuditEntry[]>(
      () => (id() ? `api/legal-entities/${id()}/history` : undefined),
      {
        defaultValue: [],
      },
    );
  }

  people(id: string) {
    return this.http.get<EntityPeople>(`api/legal-entities/${id}/people`);
  }

  /** Gives the head / the responsible person an account (login = e-mail, temporary password once). */
  grantAccess(id: string, person: EntityPerson, body: GrantAccessRequest) {
    return firstValueFrom(
      this.http.post<GrantAccessResult>(
        `api/legal-entities/${id}/people/${PERSON_TEXT[person].path}/access`,
        body,
      ),
    );
  }

  revokeAccess(id: string, person: EntityPerson) {
    return firstValueFrom(
      this.http.delete<RevokeAccessResult>(
        `api/legal-entities/${id}/people/${PERSON_TEXT[person].path}/access`,
      ),
    );
  }

  /** A new head / responsible person — replaces the current details. */
  changePerson(id: string, person: EntityPerson, body: ChangePersonRequest) {
    return firstValueFrom(
      this.http.put<ChangePersonResult>(
        `api/legal-entities/${id}/people/${PERSON_TEXT[person].path}`,
        body,
      ),
    );
  }

  /** Envelope labels of the entity: the settings and a label of this entity for the preview. */
  labelSettings(id: string) {
    return this.http.get<LabelSettingsPage>(`api/legal-entities/${id}/label-settings`);
  }

  saveLabelSettings(id: string, body: LabelSettings) {
    return firstValueFrom(
      this.http.put<LabelSettings>(`api/legal-entities/${id}/label-settings`, body),
    );
  }

  /** The reservation quota: the numbers now, the recalculations, the e-mails. */
  quota(id: string) {
    return this.http.get<QuotaPage>(`api/legal-entities/${id}/quota`);
  }

  saveQuotaNotify(id: string, body: Partial<QuotaNotifySettings>) {
    return firstValueFrom(
      this.http.put<QuotaNotifySettings>(`api/legal-entities/${id}/quota-notify`, body),
    );
  }

  /** The letterhead of the letters: the settings and the requisites it is made of. */
  letterhead(id: string) {
    return this.http.get<LetterheadSettingsPage>(`api/legal-entities/${id}/letterhead`);
  }

  saveLetterhead(id: string, body: LetterheadSettings) {
    return firstValueFrom(
      this.http.put<LetterheadSettings>(`api/legal-entities/${id}/letterhead`, body),
    );
  }

  /** Company data from the free ЄДР service by the code. */
  lookup(edrpou: string) {
    return firstValueFrom(
      this.http.get<RegistryCompany>('api/legal-entities/lookup', { params: { edrpou } }),
    );
  }
}
