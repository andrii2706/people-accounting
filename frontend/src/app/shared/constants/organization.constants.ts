import type { Organization } from '../interfaces/organization.interface';

export const EMPTY_ORG: Organization = {
  fullName: '',
  nameLocative: '',
  shortName: '',
  edrpou: '',
  address: '',
  postalCode: '',
  phone: '',
  email: '',
  headPosition: 'Директор',
  headName: '',
  letterNumberPrefix: '',
  alertDays: 30,
  notifyDeadlineDays: 7,
};

/** Text fields of the «Реквізити підприємства» card. */
export const REQUISITE_FIELDS = [
  'fullName',
  'nameLocative',
  'shortName',
  'edrpou',
  'address',
  'postalCode',
  'phone',
  'email',
  'letterNumberPrefix',
] as const satisfies readonly (keyof Organization)[];
