import type { FamilyRelation } from '../interfaces/dictionary.interface';
import type {
  EmployeeFormModel,
  FieldMeta,
  FormListKey,
  FormTabOption,
  ListItemFields,
} from '../interfaces/employee-form.interface';

export const DATE_FIELDS = [
  'birthDate',
  'passportIssuedAt',
  'foreignPassportIssuedAt',
  'foreignPassportValidUntil',
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
] as const satisfies readonly (keyof EmployeeFormModel)[];

/**
 * Where each field lives (tab) and what it is called — for navigating to an error
 * and a readable list of errors. The order = validation order on save.
 */
export const FIELD_META: Partial<Record<keyof EmployeeFormModel, FieldMeta>> = {
  lastName: { tab: 'personal', label: 'Прізвище' },
  firstName: { tab: 'personal', label: 'Ім’я' },
  middleName: { tab: 'personal', label: 'По батькові' },
  gender: { tab: 'personal', label: 'Стать' },
  birthDate: { tab: 'personal', label: 'Дата народження' },
  rnokpp: { tab: 'personal', label: 'РНОКПП' },
  personnelNumber: { tab: 'personal', label: 'Табельний номер' },
  phone: { tab: 'personal', label: 'Телефон' },
  email: { tab: 'personal', label: 'Email' },
  registeredAddress: { tab: 'personal', label: 'Зареєстроване місце проживання' },
  actualAddress: { tab: 'personal', label: 'Фактичне місце проживання' },

  passportType: { tab: 'passport', label: 'Тип паспорта' },
  passportSeries: { tab: 'passport', label: 'Серія паспорта' },
  passportNumber: { tab: 'passport', label: 'Номер паспорта' },
  passportIssuedAt: { tab: 'passport', label: 'Дата видачі паспорта' },
  passportIssuedBy: { tab: 'passport', label: 'Ким виданий паспорт' },
  foreignPassportSeries: { tab: 'passport', label: 'Серія закордонного паспорта' },
  foreignPassportNumber: { tab: 'passport', label: 'Номер закордонного паспорта' },
  foreignPassportIssuedAt: { tab: 'passport', label: 'Дата видачі закордонного паспорта' },
  foreignPassportValidUntil: { tab: 'passport', label: 'Закордонний паспорт дійсний до' },
  foreignPassportIssuedBy: { tab: 'passport', label: 'Ким виданий закордонний паспорт' },

  educations: { tab: 'education', label: 'Освіта' },

  maritalStatus: { tab: 'family', label: 'Сімейний стан' },
  familyMembers: { tab: 'family', label: 'Члени сім’ї' },

  legalEntityId: { tab: 'work', label: 'Юридична особа' },
  hireDate: { tab: 'work', label: 'Дата прийняття' },
  hireOrderDocName: { tab: 'work', label: 'Назва документа про вступ на посаду' },
  hireOrderNumber: { tab: 'work', label: 'Номер документа про прийняття' },
  hireOrderDate: { tab: 'work', label: 'Дата документа про прийняття' },
  positions: { tab: 'work', label: 'Посади' },
  dismissalDate: { tab: 'work', label: 'Дата звільнення' },
  dismissalOrderDocName: { tab: 'work', label: 'Документ про звільнення' },
  dismissalOrderNumber: { tab: 'work', label: 'Номер документа про звільнення' },
  dismissalOrderDate: { tab: 'work', label: 'Дата документа про звільнення' },

  militaryRegistered: { tab: 'military', label: 'Перебуває на обліку' },
  rankCode: { tab: 'military', label: 'Військове звання' },
  navy: { tab: 'military', label: 'Корабельні звання' },
  vos: { tab: 'military', label: 'ВОС' },
  accountingCategory: { tab: 'military', label: 'Категорія обліку / розряд' },
  trainingProfile: { tab: 'military', label: 'Склад (профіль підготовки)' },
  servedInArmy: { tab: 'military', label: 'Проходив військову службу' },
  registryNumber: { tab: 'military', label: 'Номер у реєстрі «Оберіг»' },
  militaryDocuments: { tab: 'military', label: 'Військово-облікові документи' },
  tckId: { tab: 'military', label: 'ТЦК та СП' },
  tckRegisteredAt: { tab: 'military', label: 'На обліку з' },
  fitness: { tab: 'military', label: 'Придатність' },
  fitnessDate: { tab: 'military', label: 'Дата проходження ВЛК' },
  nextVlkDate: { tab: 'military', label: 'Дата наступного ВЛК' },
  fitnessBasis: { tab: 'military', label: 'Графа, пункт наказу' },
  reserved: { tab: 'military', label: 'Заброньований' },
  reservedBy: { tab: 'military', label: 'Ким заброньовано' },
  reservedByName: { tab: 'military', label: 'Юридична особа' },
  reservedByEdrpou: { tab: 'military', label: 'ЄДРПОУ юридичної особи' },
  reservationUntil: { tab: 'military', label: 'Заброньовано до' },
  specialAccountingCertificate: { tab: 'military', label: '№ посвідчення' },
  deferralConscriptionBasis: { tab: 'military', label: 'Відстрочка від строкової служби' },
  deferralMobilizationBasis: { tab: 'military', label: 'Відстрочка від мобілізації' },
  deferralUntil: { tab: 'military', label: 'Відстрочка до' },
  deferralKind: { tab: 'military', label: 'Вид відстрочки' },
  reserveTeamNumber: { tab: 'military', label: '№ команди (резерв)' },
  mobilizationOrderDate: { tab: 'military', label: 'Мобілізаційне розпорядження' },
  mobilizedAt: { tab: 'military', label: 'Дата мобілізації' },
  mobilizationReleaseOrder: { tab: 'military', label: 'Наказ про увільнення' },
  demobilizedAt: { tab: 'military', label: 'Дата демобілізації' },
  readmissionOrder: { tab: 'military', label: 'Наказ про допуск' },
  militaryServiceInfo: { tab: 'military', label: 'Відомості про службу' },

  notes: { tab: 'notes', label: 'Примітки' },

  changeEffectiveDate: { tab: 'sidebar', label: 'Зміни діють з' },
  changeBasis: { tab: 'sidebar', label: 'Підстава змін' },
};

/** Sub-fields of the list fields (for the «what to fix» list). */
export const LIST_ITEM_FIELDS: Record<FormListKey, ListItemFields> = {
  familyMembers: {
    item: 'Член сім’ї',
    fields: ['lastName', 'firstName', 'middleName', 'birthDate'],
  },
  militaryDocuments: {
    item: 'Військово-обліковий документ',
    fields: ['type', 'series', 'number', 'issuedAt', 'generatedDate', 'generatedTime'],
  },
  positions: { item: 'Посада', fields: ['position', 'since', 'orderNumber', 'orderDate'] },
  educations: {
    item: 'Освіта',
    fields: ['level', 'institution', 'specialty', 'document', 'documentDate'],
  },
};

/** Tabs of the employee form, in display order. */
export const FORM_TABS: FormTabOption[] = [
  { id: 'personal', label: 'Особисті дані' },
  { id: 'passport', label: 'Паспорти' },
  { id: 'education', label: 'Освіта' },
  { id: 'family', label: 'Сімейний стан' },
  { id: 'work', label: 'Робота' },
  { id: 'military', label: 'Військово-облікові дані' },
  { id: 'notes', label: 'Примітки' },
];

/** Date fields of the form including the «effective from» date of changes. */
export const ALL_DATE_FIELDS = [...DATE_FIELDS, 'changeEffectiveDate'] as const;

/** Document names for the hire / transfer / dismissal (free text is allowed too). */
export const ORDER_DOC_NAMES = ['наказ', 'розпорядження', 'рішення', 'постанова', 'протокол'];

/** Relations that count as a spouse (only one per employee). */
export const SPOUSES: FamilyRelation[] = ['WIFE', 'HUSBAND'];
