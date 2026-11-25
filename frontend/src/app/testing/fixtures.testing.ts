/**
 * Fictional data for the unit tests of pages and dialogs — no real person anywhere.
 */
import { signal } from '@angular/core';
import type { EmployeeDetails } from '../shared/interfaces/employee.interface';

export const TCK_A = {
  id: 't1',
  name: 'Шевченківський РТЦК та СП',
  nameGenitive: 'Шевченківського РТЦК та СП',
  address: 'м. Тестове, вул. Військова, 5',
  postalCode: '01002',
  email: 'tck@example.com',
  phone: '',
  isActive: true,
};
export const TCK_B = {
  ...TCK_A,
  id: 't2',
  name: 'Франківський РТЦК та СП',
  nameGenitive: '',
  postalCode: '',
  address: '',
};

export function employeeDetails(over: Partial<EmployeeDetails> = {}): EmployeeDetails {
  return {
    id: 'e1',
    legalEntityId: 'le1',
    personnelNumber: '007',
    gender: 'M',
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    birthDate: '1990-01-01',
    phone: '+380501111111',
    email: 'petro@example.com',
    registeredAddress: 'м. Тестове, вул. Уявна, 1',
    actualAddress: '',
    passportType: 'ID_CARD',
    passportSeries: '',
    passportNumber: '000000001',
    passportIssuedBy: '0000',
    passportIssuedAt: '2016-01-01',
    position: 'Інженер',
    department: 'Відділ А',
    hireDate: '2020-01-01',
    dismissalDate: null,
    tckId: 't1',
    tck: TCK_A,
    tckRegisteredAt: '2020-02-01',
    militaryDocuments: [],
    familyMembers: [],
    positions: [],
    educations: [],
    changes: [],
    fieldHistory: [],
    derived: { fullName: 'Вигаданий Петро Іванович', warnings: [] },
    ...over,
  } as unknown as EmployeeDetails;
}

/** Protected members of a component — the state its template shows. */
export const internals = <T>(component: unknown) => component as T;

/** The dictionaries the dialogs read (TCKs) — as signals, like the real service. */
export function dictionariesStub(tcks = [TCK_A, TCK_B]) {
  const list = signal(tcks);
  return {
    tcks: list,
    activeTcks: () => list().filter((t) => t.isActive),
    legalEntities: signal([
      { id: 'le1', fullName: 'ТОВ «Вигадана компанія»', shortName: 'Вигадана компанія' },
    ]),
    saveTck: vi.fn(async (t: object) => ({ ...TCK_A, ...t, id: 't-new' })),
    reloadTcks: vi.fn(async () => undefined),
    severalLegalEntities: () => false,
    dictionaries: () => null,
    ranks: () => [],
    legalEntityOptions: () => [{ value: 'le1', label: 'Вигадана компанія' }],
    load: vi.fn(async () => undefined),
    reloadLegalEntities: vi.fn(async () => undefined),
    rank: () => undefined,
    groupTitle: (g: string | null | undefined) => (g ? `Група ${g}` : ''),
    categoryTitle: (c: string | null | undefined) => c ?? '',
    maritalLabel: () => '',
  };
}

/**
 * The signed-in user as the pages read him: a fictional HR of «le1». Any other check of AuthService
 * (isX / canX / hasX) answers `true`, anything else — null; `over` sets the ones a test needs.
 */
export function authStub(over: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    canEdit: () => true,
    isAdmin: () => false,
    isAuthenticated: () => true,
    user: () => ({
      id: 'u1',
      fullName: 'Кадровик Вигаданий',
      role: 'HR',
      legalEntityId: 'le1',
      modules: ['oblik'],
    }),
    initials: () => 'КВ',
    roleLabel: () => 'Кадровик',
    ...over,
  };
  return new Proxy(base, {
    get: (target, key: string) =>
      key in target ? target[key] : /^(is|can|has)[A-Z]/.test(key) ? () => true : () => null,
  });
}

export const toastStub = () => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
});

/** A row of the employee list (fictional). */
export function listItem(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    personnelNumber: '007',
    gender: 'M',
    lastName: 'Вигаданий',
    firstName: 'Петро',
    middleName: 'Іванович',
    fullName: 'Вигаданий Петро Іванович',
    birthDate: '1990-01-01',
    position: 'Інженер',
    department: 'Відділ А',
    hireDate: '2020-01-01',
    dismissalDate: null,
    rankCode: 1,
    vos: '',
    tckName: 'Шевченківський РТЦК та СП',
    legalEntityId: 'le1',
    legalEntityName: 'Вигадана компанія',
    reservationUntil: null,
    deferral: false,
    deferralUntil: null,
    pendingChanges: 0,
    dismissalOrderDocName: '',
    dismissalOrderNumber: '',
    dismissalOrderDate: null,
    dismissalNotice: null,
    warnings: [],
    onLists: true,
    employed: true,
    reserved: false,
    mobilized: false,
    listGroup: 'G2',
    dutyCategory: 'LIABLE',
    ...over,
  };
}
