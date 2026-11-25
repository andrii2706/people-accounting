/**
 * Fictional people and accounts for unit tests — no real personal data anywhere.
 */
import type { AuthUser } from '../src/shared/interfaces/auth.interface.js';

export const ADMIN: AuthUser = {
  id: 'u-admin',
  email: 'admin@example.com',
  fullName: 'Адміністратор Тестовий',
  role: 'ADMIN',
  legalEntityId: null,
} as unknown as AuthUser;

export const HR: AuthUser = {
  id: 'u-hr',
  email: 'hr@example.com',
  fullName: 'Кадровик Вигаданий',
  role: 'HR',
  legalEntityId: 'le1',
} as unknown as AuthUser;

/** The organisation settings the services read (OrganizationService.get()). */
export const ORG = {
  id: 1,
  alertDays: 30,
  notifyDeadlineDays: 7,
  mobilizationUntil: '2027-02-05',
  mobilizationConfirmedUntil: '2027-02-05',
};

/** A working military-liable man — every field fictional. */
export function person(over: Record<string, unknown> = {}) {
  return {
    legalEntityId: 'le1',
    personnelNumber: '007',
    gender: 'M',
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    birthDate: '1990-01-01',
    rnokpp: '',
    phone: '',
    email: '',
    registeredAddress: 'м. Тестове, вул. Уявна, 1',
    actualAddress: '',
    passportType: 'ID',
    passportSeries: '',
    passportNumber: '000000001',
    passportIssuedBy: '0000',
    passportIssuedAt: '2016-01-01',
    position: 'Інженер',
    department: 'Відділ А',
    hireDate: '2020-01-01',
    hireOrderDocName: '',
    hireOrderNumber: '',
    hireOrderDate: null,
    dismissalDate: null,
    dismissalOrderDocName: '',
    dismissalOrderNumber: '',
    dismissalOrderDate: null,
    militaryRegistered: true,
    rankCode: 1,
    vos: '',
    tckId: null,
    tckRegisteredAt: null,
    reserved: false,
    reservationUntil: null,
    militaryDocuments: [],
    familyMembers: [],
    positions: [],
    educations: [],
    ...over,
  };
}
