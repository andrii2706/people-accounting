import type {
  AccessRole,
  EntityPeople,
  EntityPerson,
  LegalEntityForm,
} from '../interfaces/legal-entity.interface';
import type { SelectOption } from '../interfaces/ui.interface';

export const EMPTY_LEGAL_ENTITY: LegalEntityForm = {
  fullName: '',
  nameLocative: '',
  shortName: '',
  edrpou: '',
  address: '',
  postalCode: '',
  phone: '',
  email: '',
  letterNumberPrefix: '',
  headPosition: 'Директор',
  headName: '',
  responsibleName: '',
  responsiblePosition: '',
  responsiblePhone: '',
  reservationQuota: '',
  reservationQuotaBasis: '',
  notifyEmails: '',
};

/** Company page in YouControl (free part: requisites, head, court cases, sanctions). */
export const YOUCONTROL_COMPANY_URL = 'https://youcontrol.com.ua/catalog/company_details/{code}/';

/** Roles the head / the responsible person can get. */
export const ACCESS_ROLE_OPTIONS: SelectOption<AccessRole>[] = [
  { value: 'HR', label: 'Працівник з обліку', hint: 'працівники, листи, звіти' },
  { value: 'DIRECTOR', label: 'Директор', hint: 'перегляд усього і підписання документів' },
  { value: 'ADMIN', label: 'Адміністратор', hint: 'ще й налаштування та користувачі' },
];

/** Words about the person in the UI. */
export const PERSON_TEXT: Record<EntityPerson, { who: string; whom: string; path: string }> = {
  HEAD: { who: 'Керівник', whom: 'керівника', path: 'head' },
  RESPONSIBLE: { who: 'Відповідальний', whom: 'відповідального', path: 'responsible' },
};

/** A new legal entity has no accounts yet. */
export const NO_PEOPLE: EntityPeople = { HEAD: null, RESPONSIBLE: null };
