import type { ChangeRule } from '../shared/interfaces/employee.interface.js';
import type { Employee } from './entities/employee.entity.js';
import { militaryDocText, passportText, rankText } from '../military/employee-format.js';
import { dateUa, deferralText, joinParts, reservationText } from './utils/employee-text.utils.js';
import type { FamilyRelation } from '../shared/interfaces/dictionary.interface.js';
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

export const CHANGE_RULES: ChangeRule[] = [
  { type: 'LAST_NAME', value: (e) => e.lastName },
  { type: 'FIRST_NAME', value: (e) => e.firstName },
  { type: 'MIDDLE_NAME', value: (e) => e.middleName },
  { type: 'POSITION', value: (e) => e.position, requireValue: true },
  { type: 'REGISTERED_ADDRESS', value: (e) => e.registeredAddress, requireValue: true },
  { type: 'ACTUAL_ADDRESS', value: (e) => e.actualAddress, requireValue: true },
  { type: 'PASSPORT', value: passportText, requireValue: true },
  { type: 'REGISTRY_NUMBER', value: (e) => e.registryNumber ?? '', requireValue: true },
  { type: 'RANK', value: (e) => rankText(e) },
  { type: 'VOS', value: (e) => e.vos ?? '' },
  { type: 'MILITARY_DOC', value: (e) => militaryDocText(e) },
  { type: 'TCK', value: (e) => e.tck?.name ?? '', requireValue: true },
  { type: 'FITNESS', value: (e) => joinParts([e.fitness, e.fitnessBasis], ' ') },
  {
    type: 'MILITARY_SERVICE',
    value: (e) =>
      joinParts([
        e.servedInArmy ? 'проходив(-ла) військову службу' : '',
        e.mobilizedAt ? `призван${e.gender === 'F' ? 'а' : 'ий'} на військову службу з ${dateUa(e.mobilizedAt)}` : '',
      ]),
  },
  { type: 'DEFERRAL', value: deferralText },
  { type: 'RESERVATION', value: reservationText },
  { type: 'RESERVE_SERVICE', value: (e) => (e.reserveTeamNumber ? `команда № ${e.reserveTeamNumber}` : '') },
  {
    type: 'MOBILIZATION_ORDER',
    value: (e) => (e.mobilizationOrderDate ? `від ${dateUa(e.mobilizationOrderDate)}` : ''),
  },
  // Foreign passport, education and marital status are no longer reported (Resolution No. 812 of 10.06.2026);
  // the types stay in ChangeType for the history of earlier notices.
];

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
