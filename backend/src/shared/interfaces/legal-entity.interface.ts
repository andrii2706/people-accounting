/** Company data found in the Unified State Register by its code — to fill the legal entity form. */
export interface RegistryCompany {
  edrpou: string;
  fullName: string;
  shortName: string;
  address: string;
  postalCode: string;
  /** As in the signature: «Іван ПЕТРЕНКО». */
  headName: string;
  /** Main activity (КВЕД) — for reference. */
  kved: string;
  /** Where the data came from — shown under the form. */
  source: string;
}

/** A legal entity in the list: requisites, head, responsible person and how many employees it has. */
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
  employees: number;
  /** Reservation quota (null — not set) and how many working employees the entity has reserved today. */
  reservationQuota: number | null;
  reservedCompany: number;
}

/** Quota use of one legal entity on a date (dashboard). */
export interface EntityQuota {
  id: string;
  name: string;
  quota: number | null;
  reservedCompany: number;
  available: number | null;
  exceeded: boolean;
}

/** Raw answer of the ЄДР lookup service (field names as documented by the provider). */
export interface RegistryRawCompany {
  egrpou?: string | number;
  name?: string;
  name_short?: string;
  address?: string;
  director?: string;
  kved?: string;
  kved_number?: string;
}

/** Postgres row count by legal entity. */
export interface EntityCountRow {
  legalEntityId: string;
  count: string;
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
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

/** Result of giving access: a new account gets a temporary password (shown once). */
export interface GrantAccessResult {
  access: PersonAccess;
  /** null — an existing account was linked, its password did not change. */
  temporaryPassword: string | null;
  /** The temporary password was e-mailed to the person (the access mailbox is set). */
  mailSent: boolean;
  expiresAt: Date | null;
}

/** Result of turning access off. */
export interface RevokeAccessResult {
  /** false — the account is still linked to another legal entity, so it stays active. */
  deactivated: boolean;
  email: string;
}
