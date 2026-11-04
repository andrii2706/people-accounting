import type { NotificationStatus } from './organization.interface';

/** A legal entity of the client in the list: requisites, the head and the responsible person. */
export interface LegalEntitySummary {
  id: string;
  fullName: string;
  shortName: string;
  edrpou: string;
  headPosition: string;
  headName: string;
  responsibleName: string;
  responsiblePosition: string;
  headUserId: string | null;
  responsibleUserId: string | null;
  /** Employees (working and dismissed) that belong to it. */
  employees: number;
  /** Reservation quota (null — not set) and how many working employees it has reserved today. */
  reservationQuota: number | null;
  reservedCompany: number;
}

/** The legal entity form (GET /api/legal-entities/:id and the body of POST / PATCH). */
export interface LegalEntityForm {
  fullName: string;
  nameLocative: string;
  shortName: string;
  edrpou: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  letterNumberPrefix: string;
  headPosition: string;
  headName: string;
  responsibleName: string;
  responsiblePosition: string;
  responsiblePhone: string;
  /** Reservation quota as typed ('' — not set). */
  reservationQuota: string;
  reservationQuotaBasis: string;
  /** Extra e-mail addresses for reminders about its employees, comma-separated. */
  notifyEmails: string;
}

/** Request body of POST / PATCH: no user — null. */
export interface LegalEntityBody extends Omit<LegalEntityForm, 'reservationQuota'> {
  reservationQuota: number | null;
}

export interface LegalEntity extends LegalEntityBody {
  id: string;
  headUserId: string | null;
  responsibleUserId: string | null;
}

/** Company data found in the free ЄДР service — to fill the form. */
export interface RegistryCompany {
  edrpou: string;
  fullName: string;
  shortName: string;
  address: string;
  postalCode: string;
  headName: string;
  kved: string;
  source: string;
}

/** Route data of the legal entity form: the entity (null — a new one), the users, the e-mail status. */
export interface LegalEntityPageData {
  entity: LegalEntity | null;
  /** System accounts of the head and of the responsible person (none for a new entity). */
  people: EntityPeople;
  status: NotificationStatus;
}

/** Who in the legal entity: the head or the person responsible for military registration. */
export type EntityPerson = 'HEAD' | 'RESPONSIBLE';

/** Roles a head / responsible person can get. */
export type AccessRole = 'HR' | 'DIRECTOR' | 'ADMIN';

/** The system account linked to the head / the responsible person. */
export interface PersonAccess {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}

export type EntityPeople = Record<EntityPerson, PersonAccess | null>;

/** POST …/people/:person/access — a new account gets a temporary password (shown once). */
export interface GrantAccessResult {
  access: PersonAccess;
  temporaryPassword: string | null;
}

/** DELETE …/people/:person/access */
export interface RevokeAccessResult {
  /** false — the account is linked to another legal entity and stays on. */
  deactivated: boolean;
  email: string;
}

export interface GrantAccessRequest {
  email: string;
  role: AccessRole;
}

/** PUT …/people/:person — a new head / responsible person. */
export interface ChangePersonRequest {
  fullName: string;
  position: string;
  phone?: string;
  revokePrevious: boolean;
  email?: string;
  role?: AccessRole;
}

export interface ChangePersonResult {
  revoked: RevokeAccessResult | null;
  granted: GrantAccessResult | null;
}

/** The «replace the person» form. */
export interface ChangePersonForm {
  fullName: string;
  position: string;
  phone: string;
  revokePrevious: boolean;
  email: string;
  role: AccessRole;
}
