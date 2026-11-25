import type { ChangeRule } from '../shared/interfaces/employee.interface.js';
import type { Employee } from './entities/employee.entity.js';
import { passportText } from '../military/employee-format.js';
import type { ChangeType, FamilyRelation } from '../shared/interfaces/dictionary.interface.js';
import type { MaritalStatus } from '../shared/interfaces/dictionary.interface.js';

/** Import: hiring / dismissal notices are queued for dates within this many days back (mode RECENT). */
export const RECENT_NOTICE_DAYS = 30;

export const NULLABLE_DATES = new Set<keyof Employee>([
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'foreignPassportValidUntil',
  'educationDocumentDate',
  'positionSince',
  'hireDate',
  'hireOrderDate',
  'dismissalDate',
  'dismissalOrderDate',
  'tckRegisteredAt',
  'fitnessDate',
  'nextVlkDate',
  'reservationUntil',
  'deferralUntil',
  'mobilizationOrderDate',
  'mobilizedAt',
  'demobilizedAt',
]);

/**
 * What the TCK is notified about (Annex 4 of Procedure No. 1487, the grounds since 27.06.2026, unchanged on
 * 13.08.2026): the surname, name, patronymic; the details of the Ukrainian passport; the registered or the actual
 * address; the position (a transfer or a new name of the position) — and the hiring and the dismissal
 * (added separately). The military data (rank, VOS, the document, the TCK, fitness, deferral, reservation…)
 * the employer does not report: they come from the TCK and are only written into the lists. The foreign passport,
 * education and marital status are not reported since Resolution No. 812 of 10.06.2026.
 * The other types stay in ChangeType for the history of earlier notices.
 */
export const CHANGE_RULES: ChangeRule[] = [
  { type: 'LAST_NAME', value: (e) => e.lastName },
  { type: 'FIRST_NAME', value: (e) => e.firstName },
  { type: 'MIDDLE_NAME', value: (e) => e.middleName },
  { type: 'POSITION', value: (e) => e.position, requireValue: true },
  { type: 'REGISTERED_ADDRESS', value: (e) => e.registeredAddress, requireValue: true },
  { type: 'ACTUAL_ADDRESS', value: (e) => e.actualAddress, requireValue: true },
  { type: 'PASSPORT', value: passportText, requireValue: true },
];

/** Contacts and addresses whose changes are kept with the date they happened (employee_field_history). */
export const HISTORY_CONTACT_FIELDS = ['phone', 'email', 'registeredAddress', 'actualAddress'] as const;

/** The change types the TCK is notified about — the rules above plus the hiring and the dismissal. */
export const NOTICE_CHANGE_TYPES: ChangeType[] = [...CHANGE_RULES.map((r) => r.type), 'HIRE', 'DISMISSAL'];

export const FIELD_LABELS: Record<string, string> = {
  fullName: 'ПІБ',
  source: 'Джерело',
  personnelNumber: 'Табельний номер',
  gender: 'Стать',
  lastName: 'Прізвище',
  firstName: 'Ім’я',
  middleName: 'По батькові',
  rnokpp: 'РНОКПП',
  birthDate: 'Дата народження',
  phone: 'Телефон',
  email: 'Email',
  registeredAddress: 'Адреса реєстрації',
  actualAddress: 'Фактична адреса',
  passportType: 'Тип паспорта',
  passportSeries: 'Серія паспорта',
  passportNumber: 'Номер паспорта',
  passportIssuedBy: 'Ким виданий паспорт',
  passportIssuedAt: 'Дата видачі паспорта',
  foreignPassportSeries: 'Серія закордонного паспорта',
  foreignPassportNumber: 'Номер закордонного паспорта',
  foreignPassportIssuedBy: 'Ким виданий закордонний паспорт',
  foreignPassportIssuedAt: 'Дата видачі закордонного паспорта',
  foreignPassportValidUntil: 'Закордонний паспорт дійсний до',
  educationLevel: 'Освіта',
  educationSpecialty: 'Спеціальність',
  educationDocument: 'Документ про освіту',
  educationDocumentDate: 'Дата документа про освіту',
  educations: 'Освіта (усі документи)',
  maritalStatus: 'Сімейний стан',
  familyMembers: 'Склад сім’ї',
  positions: 'Посади (місця роботи)',
  position: 'Посада',
  department: 'Підрозділ',
  positionOrder: 'Наказ про призначення на посаду',
  positionSince: 'На посаді з',
  hireDate: 'Дата прийняття',
  hireOrderDocName: 'Документ про прийняття',
  hireOrderNumber: 'Номер наказу про прийняття',
  hireOrderDate: 'Дата наказу про прийняття',
  dismissalDate: 'Дата звільнення',
  dismissalOrderDocName: 'Документ про звільнення',
  dismissalOrderNumber: 'Номер наказу про звільнення',
  dismissalOrderDate: 'Дата наказу про звільнення',
  militaryRegistered: 'На військовому обліку',
  registryNumber: 'Номер у реєстрі «Оберіг»',
  rankCode: 'Військове звання',
  navy: 'Корабельний склад (ВМС)',
  vos: 'ВОС',
  trainingProfile: 'Склад (профіль підготовки)',
  accountingCategory: 'Категорія обліку / розряд',
  militaryDocuments: 'Військово-облікові документи',
  servedInArmy: 'Проходив військову службу',
  tckId: 'ТЦК та СП',
  legalEntityId: 'Юридична особа',
  tckRegisteredAt: 'На обліку в ТЦК з',
  fitness: 'Придатність',
  fitnessBasis: 'Графа, пункт наказу',
  fitnessDate: 'Дата проходження ВЛК',
  nextVlkDate: 'Дата наступного ВЛК',
  reserved: 'Заброньований',
  reservationBasis: 'Підстава бронювання',
  reservationUntil: 'Заброньовано до',
  reservedBy: 'Ким заброньовано',
  reservedByName: 'Юридична особа, що забронювала',
  reservedByEdrpou: 'ЄДРПОУ юридичної особи',
  specialAccountingCertificate: '№ посвідчення (спецоблік)',
  deferralConscriptionBasis: 'Відстрочка від строкової служби',
  deferralMobilizationBasis: 'Відстрочка від мобілізації',
  deferralUntil: 'Відстрочка до',
  deferralUntilMobilizationEnd: 'Відстрочка до завершення мобілізації',
  partTimeNotInQuota: 'Сумісник — не враховується у квоту бронювання',
  reserveTeamNumber: 'Служба в резерві — № команди',
  mobilizationOrderDate: 'Мобілізаційне розпорядження від',
  militaryServiceInfo: 'Відомості про військову службу',
  mobilizedAt: 'Дата мобілізації',
  mobilizationReleaseOrder: 'Наказ про увільнення',
  demobilizedAt: 'Дата демобілізації',
  readmissionOrder: 'Наказ про допуск до роботи',
  notes: 'Примітки',
  dismissalBasis: 'Підстава звільнення',
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Створено картку',
  UPDATE: 'Змінено дані',
  DISMISS: 'Звільнено',
  DELETE: 'Видалено',
  VIEW: 'Переглянуто',
  EXPORT: 'Вивантажено',
};

/** Allowed marital statuses. */
export const MARITAL_STATUS_CODES: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];

/** Allowed relations of family members. */
export const FAMILY_RELATIONS: FamilyRelation[] = ['HUSBAND', 'WIFE', 'SON', 'DAUGHTER'];
