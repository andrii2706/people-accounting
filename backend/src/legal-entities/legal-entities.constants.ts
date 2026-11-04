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
export const ACCESS_ROLES: AccessRole[] = ['HR', 'DIRECTOR', 'ADMIN'];

/** «…надав вам доступ як …» in the letter with a temporary password. */
export const PERSON_AS_WHOM = {
  HEAD: 'керівнику',
  RESPONSIBLE: 'відповідальній особі за військовий облік',
} as const;
