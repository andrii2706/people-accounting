import type { AccessRole } from '../shared/interfaces/legal-entity.interface.js';
/** Waiting for the ЄДР lookup service at most this long. */
export const REGISTRY_TIMEOUT_MS = 8000;

/** Public company page on YouControl — for a manual check of the counterparty. */
export const YOUCONTROL_COMPANY_URL = 'https://youcontrol.com.ua/catalog/company_details/{code}/';

export const REGISTRY_SOURCE_LABEL = 'Єдиний державний реєстр (adm.tools)';

/** Fields of the head / the responsible person in a legal entity. */
export const PERSON_FIELDS = {
  HEAD: { name: 'headName', position: 'headPosition', phone: null, userId: 'headUserId' },
  RESPONSIBLE: {
    name: 'responsibleName',
    position: 'responsiblePosition',
    phone: 'responsiblePhone',
    userId: 'responsibleUserId',
  },
} as const;

/** Who the person is, for messages. */
export const PERSON_LABELS = { HEAD: 'керівника', RESPONSIBLE: 'відповідального' } as const;

/** Roles the head / the responsible person can get (the head usually — DIRECTOR). */
export const ACCESS_ROLES: AccessRole[] = ['HR', 'DIRECTOR', 'ENTITY_ADMIN'];

/** «…надав вам доступ як …» in the letter with a temporary password. */
export const PERSON_AS_WHOM = {
  HEAD: 'керівнику',
  RESPONSIBLE: 'відповідальній особі за військовий облік',
} as const;

/** Journal of a legal entity: what each entry did. */
export const ENTITY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Додано юрособу',
  UPDATE: 'Змінено дані',
  DELETE: 'Видалено юрособу',
};

/** Journal fields that are not columns of the form. */
export const ENTITY_HISTORY_LABELS: Record<string, string> = {
  HEAD_ACCESS: 'Доступ керівника до системи (логін)',
  RESPONSIBLE_ACCESS: 'Доступ відповідального до системи (логін)',
  HEAD_PREVIOUS_ACCESS: 'Доступ попереднього керівника',
  RESPONSIBLE_PREVIOUS_ACCESS: 'Доступ попереднього відповідального',
};

/** Fields compared for the journal when the form is saved. */
export const ENTITY_FORM_FIELDS = [
  'fullName',
  'nameLocative',
  'shortName',
  'edrpou',
  'address',
  'postalCode',
  'phone',
  'email',
  'letterNumberPrefix',
  'headPosition',
  'headName',
  'responsibleName',
  'responsiblePosition',
  'responsiblePhone',
  'reservationQuotaPercent',
  'reservationQuotaBasis',
  'notifyEmails',
] as const;

/** A legal entity of another scope is answered like a missing one. */
export const ENTITY_NOT_FOUND = 'Юридичну особу не знайдено';
